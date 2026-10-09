import { objectionMap, type QuestionBank } from "./bank-types";
import { briefToText, type BriefSection } from "./brief";
import type { PatientCase } from "./cases";
import type { Blocks } from "./prompt-blocks";
import type { Stage, TranscriptEntry, TreatmentPlan } from "./types";

/**
 * One prompt builder for every channel. The voice agent (Vapi) and the chat
 * agent (OpenAI) run the same persona from the same text, so the patient
 * behaves consistently as the candidate moves from call to chat and back.
 *
 * Nothing the patient is told is hard-coded any more: the shared wording comes
 * from `prompt_blocks`, the question and objection banks from `question_banks`,
 * and the rest from the case itself. `assemblePrompt` is what actually reaches
 * the model, which is also what the panel shows when someone asks to see a
 * case's prompt — there is no second, hidden version.
 */

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in vars ? vars[key] : match,
  );
}

function caseBlock(c: PatientCase, banks: QuestionBank[], objections: QuestionBank): string {
  const byKey = new Map(banks.map((b) => [b.key, b]));
  const bankText = c.technicalBanks
    .map((k) => byKey.get(k))
    .filter((b): b is QuestionBank => Boolean(b))
    .map((b) => `### Bank ${b.key} — ${b.title}\n${b.questions.map((q) => `- ${q}`).join("\n")}`)
    .join("\n\n");

  const extra = c.extraQuestions.length
    ? `\n### Case-specific questions\n${c.extraQuestions.map((q) => `- ${q}`).join("\n")}`
    : "";

  // An entry is either a key into the objection bank or the objection itself,
  // so the panel can add one-off objections without touching the bank.
  const map = objectionMap(objections);
  const chain = c.objectionChain.map((k, i) => `${i + 1}. ${map[k] ?? k}`).join("\n");

  return `
## YOUR IDENTITY

You are ${c.name}${c.age ? `, ${c.age}` : ""}${c.country ? `, from ${c.country}` : ""}.

Situation: ${c.situation ?? "—"}
Personality: ${c.personality ?? "—"}
${c.voice.accent ? `You speak with a ${c.voice.accent} manner.` : ""}

Your case, as the clinic has planned it (you do NOT know this — it is here so you can react correctly when the candidate describes it): ${c.casePlan ?? "—"}

### Hidden signals you drop
Mention each of these ONCE, in passing, without explaining its importance. Do not repeat or emphasise them. A good candidate picks them up and follows them.
${c.hiddenSignals.map((s) => `- ${s}`).join("\n") || "- (none)"}

## TECHNICAL QUESTIONS YOU MAY ASK
Ask these in your own words, as a patient would — never read them out verbatim. Weave 4–6 of them naturally into the second call.

${bankText}${extra}

## YOUR OBJECTION CHAIN
Deliver these ONE AT A TIME, in this order. When the candidate handles one adequately, do NOT convert — transition with "Hmm, okay... but one more thing..." and raise the next.
FAIL RULE: if the candidate cannot resolve an objection after 2 attempts, say something noncommittal and move to the next one.

${chain || "(none configured)"}
${c.specialRule ? `\n## SPECIAL RULE FOR YOU\n${c.specialRule}` : ""}
${c.extraPrompt ? `\n## ADDITIONAL INSTRUCTIONS\n${c.extraPrompt}` : ""}
`.trim();
}

function planText(plan: TreatmentPlan | null): string {
  if (!plan) {
    return "The candidate has NOT sent you a written plan. Note that, and react as a patient who was promised one would — but still do not raise it yourself.";
  }
  const lines = plan.items.map((i) => {
    const price = i.unit_price ? ` — ${i.unit_price} ${plan.currency} each` : "";
    return `- ${i.treatment} × ${i.quantity}${price}`;
  });
  return `
This is the treatment plan the candidate sent you in writing. You have read it and understand roughly half of it. Do NOT mention it until they do.

Summary: ${plan.summary}
Items:
${lines.join("\n")}
Total: ${plan.total_price} ${plan.currency}
Trip: ${plan.trip_days} days, ${plan.visits} visit(s)
Guarantee: ${plan.guarantee}
Included: ${plan.included}
Proposed next step: ${plan.next_step}
`.trim();
}

function stageBlock(
  stage: Stage,
  blocks: Blocks,
  c: PatientCase,
  plan: TreatmentPlan | null,
): string {
  switch (stage) {
    case "call_1":
      return fill(blocks.stage_call_1, { discovery_checklist: blocks.discovery_checklist });
    case "chat":
      return blocks.stage_chat;
    case "call_2":
      return fill(blocks.stage_call_2, {
        plan: planText(plan),
        case_plan: c.casePlan ?? "—",
      });
    default:
      return "";
  }
}

function historyBlock(history: TranscriptEntry[]): string {
  if (!history.length) return "";
  const lines = history.map((e) => {
    const who = e.speaker === "candidate" ? "CANDIDATE" : e.speaker === "patient" ? "YOU" : "SYSTEM";
    const att = e.attachments?.length ? ` [sent ${e.attachments.length} photo(s)]` : "";
    return `${who}: ${e.text}${att}`;
  });
  return `
## WHAT HAS ALREADY HAPPENED IN THIS SESSION

This is the conversation so far, across the earlier stages. Remember it. Do not ask again for something you were already told, and react if the candidate contradicts something they said earlier.

${lines.join("\n")}
`.trim();
}

export interface PromptContext {
  patient: PatientCase;
  brief: BriefSection[];
  blocks: Blocks;
  banks: QuestionBank[];
  objections: QuestionBank;
  stage: Stage;
  history: TranscriptEntry[];
  plan: TreatmentPlan | null;
  candidateName: string;
}

export function buildPatientPrompt(ctx: PromptContext): string {
  return [
    fill(ctx.blocks.intro, { candidate_name: ctx.candidateName }),
    ctx.blocks.master_rules,
    caseBlock(ctx.patient, ctx.banks, ctx.objections),
    stageBlock(ctx.stage, ctx.blocks, ctx.patient, ctx.plan),
    `## THE CLINIC'S REAL FACTS (for your judgement only — never recite these)\n\n${briefToText(ctx.brief)}`,
    historyBlock(ctx.history),
    ctx.blocks.out_of_scope,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");
}
