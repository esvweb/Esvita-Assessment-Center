import { REPORT_MODEL, openai } from "./openai";
import { briefToText, type BriefSection } from "./brief";
import { objectionMap, type QuestionBank } from "./bank-types";
import type { PatientCase } from "./cases";
import type { RubricVersion } from "./rubric";
import type { AssessmentSession, TranscriptEntry } from "./types";
import { analyseUpsell, upsellToText, type CatalogueEntry } from "./upsell";

/**
 * Turns a finished session into the HR evaluation report.
 *
 * The grader is a separate pass with no roleplay instructions — it sees the
 * transcript, the profile it was run against and the clinic's real facts, and
 * scores against the seven criteria from the persona document.
 */

/** Built from the active rubric, so editing the criteria changes the report. */
function schemaFor(rubric: RubricVersion) {
  const keys = rubric.criteria.map((c) => c.key);
  return {
    type: "object",
    properties: {
      outcome: { type: "string", enum: ["CLOSED", "WARM-CLOSE", "LOST"] },
      scores: {
        type: "object",
        properties: Object.fromEntries(
          keys.map((k) => [k, { type: "integer", enum: [1, 2, 3, 4, 5] }]),
        ),
        required: keys,
        additionalProperties: false,
      },
      overall: { type: "number" },
      hire_signal: { type: "string", enum: ["STRONG YES", "YES", "BORDERLINE", "NO"] },
      markdown: {
        type: "string",
        description:
          "The full report in Markdown, following the required template exactly, including the verbatim disclaimer line.",
      },
    },
    required: ["outcome", "scores", "overall", "hire_signal", "markdown"],
    additionalProperties: false,
  };
}

const DISCLAIMER =
  "This report is an AI-generated assessment based on a simulated roleplay. It may contain inaccuracies or bias and should be used as one input among others, not as a sole hiring decision.";

function renderTranscript(entries: TranscriptEntry[]): string {
  const label: Record<string, string> = {
    voice_1: "CALL 1",
    chat: "MESSAGING",
    voice_2: "CALL 2",
    system: "SYSTEM",
  };
  let current = "";
  const out: string[] = [];
  for (const e of entries) {
    if (e.channel !== current) {
      current = e.channel;
      out.push(`\n===== ${label[e.channel] ?? e.channel} =====`);
    }
    const who =
      e.speaker === "candidate" ? "CANDIDATE" : e.speaker === "patient" ? "PATIENT" : "SYSTEM";
    const att = e.attachments?.length ? ` [+${e.attachments.length} photos]` : "";
    out.push(`${who}: ${e.text}${att}`);
  }
  return out.join("\n");
}

export interface GeneratedReport {
  rubricVersionId: string;
  rubricVersion: number;
  outcome: "CLOSED" | "WARM-CLOSE" | "LOST";
  scores: Record<string, number>;
  overall: number;
  hire_signal: "STRONG YES" | "YES" | "BORDERLINE" | "NO";
  markdown: string;
  model: string;
}

export async function generateReport(
  session: AssessmentSession,
  patient: PatientCase,
  brief: BriefSection[],
  rubric: RubricVersion,
  transcript: TranscriptEntry[],
  briefShownToCandidate: boolean,
  /** The assessment's price list, which the upsell figures are worked out from. */
  catalogue: CatalogueEntry[],
  /** The assessment's own objection bank — the one the patient was actually given. */
  objectionBank: QuestionBank,
  /** Shown to the candidate beside the price list; the extraction rules live here. */
  pricingNotes = "",
): Promise<GeneratedReport> {
  const bank = objectionMap(objectionBank);
  const objections = patient.objectionChain
    .map((k, i) => `${i + 1}. ${k} — "${bank[k] ?? k}"`)
    .join("\n");

  // A case with plan lines gets the computed breakdown. An older case with only
  // a hand-typed total falls back to comparing totals.
  const upsell = patient.doctorPlanItems.length
    ? upsellToText(analyseUpsell(patient.doctorPlanItems, session.plan, catalogue))
    : `Doctor's plan value: ${
        patient.doctorPlanValue != null
          ? `${patient.doctorPlanValue} ${patient.doctorPlanCurrency}`
          : "(not configured)"
      }
Candidate quoted: ${
        session.plan ? `${session.plan.total_price} ${session.plan.currency}` : "(no plan was sent)"
      }`;

  const system = `
You are an assessor for the HR team at Esvita Clinic (dental treatments and hair transplantation, Istanbul). You are NOT roleplaying — the roleplay is over. You are grading a job candidate's performance in a simulated multi-stage sales session for the Senior Medical Advisor / Sales Consultant position.

Base every judgement on what actually happened in the transcript. Quote or paraphrase specific transcript moments as evidence for every claim. Do not invent behaviour that is not in the transcript. Where the transcript is ambiguous, say so rather than guessing.


## WHAT THE PATIENT WAS INSTRUCTED TO DO

Profile: ${patient.name}, ${patient.age}, ${patient.country} — ${patient.headline}
Situation: ${patient.situation}
Case plan the clinic had prepared: ${patient.casePlan}

## THE DENTIST'S INDICATION AND THE UPSELL COMPARISON

This is what the treating dentist prescribed after reviewing the photos, and what that plan is worth at the clinic's list prices. The candidate saw the indication but NOT its value — the figure was withheld so that they price the plan themselves rather than match a number — and they built their plan from the same price list.

${patient.doctorIndication ?? "(no indication was configured for this case)"}

${pricingNotes.trim() ? `Pricing notes the candidate saw beside the price list:\n${pricingNotes.trim()}\n\n` : ""}${upsell}

These figures are computed from the price list and are exact. Use them as given — do not recompute them, and do not contradict them. Your job is to judge what they mean, in BOTH directions:
- **Priced above list** — the candidate charged more than the list price. Legitimate only if they justified it to the patient; note whether they did.
- **Alternatives within a group** — a better implant brand, crown material or transplant technique than the dentist's baseline. This is the core legitimate upsell when the patient genuinely benefits and the candidate explained why. A lower-priced alternative is value left on the table unless the patient asked for it.
- **Added beyond the indication** — treatment the dentist did not prescribe, or more units than indicated. This is overselling and a red flag regardless of the revenue, unless it is a comfort item the patient asked for — say which it is.
- **Left out** — indicated treatment the candidate dropped: value left on the table, and possibly a clinically incomplete plan.
- Where the indication contains a medical hold, selling past it is a serious failure no matter what the numbers say.

State the dentist's figure, the candidate's figure and the difference in absolute and percentage terms (all given above), name the biggest driver of the difference, and give your verdict.
${patient.specialRule ? `Special measurement rule for this profile: ${patient.specialRule}` : ""}

Hidden signals the patient was told to plant (check whether the candidate picked each one up):
${patient.hiddenSignals.map((s) => `- ${s}`).join("\n")}

Objection chain the patient was told to run:
${objections}

## WHAT THE CANDIDATE WAS GIVEN

${
    briefShownToCandidate
      ? "The candidate read the clinic briefing below before the first call and kept it beside them throughout. Judge factual accuracy strictly — the figures were in front of them."
      : "IMPORTANT: this assessment deliberately withheld the clinic briefing. The candidate went in WITHOUT the price list, package terms, timelines or guarantee, and could not look anything up. Do not penalise them for not quoting exact figures. Judge instead how they handled not knowing: did they stay credible, avoid inventing specifics, promise to confirm and come back, and still move the patient forward? Inventing a confident but wrong figure is worse here than admitting they will check."
  }

## THE CLINIC'S REAL FACTS
Use these to judge whether the candidate's technical and commercial answers were correct. An answer that contradicts these is wrong, and dangerous misinformation must be flagged separately.

${briefToText(brief)}

## THE CRITERIA (score each 1–5)

${rubric.criteria.map((c, i) => `${i + 1}. **${c.label}** (\`${c.key}\`) — ${c.description}`).join("\n\n")}

${rubric.instructions}

End the markdown with this line verbatim:
"${DISCLAIMER}"
`.trim();

  const userContent = `
Candidate: ${session.candidate_name}
Profile used: #${patient.id} (${patient.name})\nRubric version: v${rubric.version}
Date: ${new Date().toISOString().slice(0, 10)}
Photos actually requested by the candidate: ${session.photos_requested ? "YES" : "NO"}
Written treatment plan sent: ${session.plan ? "YES" : "NO"}

FULL SESSION TRANSCRIPT
${renderTranscript(transcript)}
`.trim();

  const completion = await openai().chat.completions.create({
    model: REPORT_MODEL,
    max_completion_tokens: 16000,
    reasoning_effort: "high",
    response_format: {
      type: "json_schema",
      json_schema: { name: "evaluation_report", schema: schemaFor(rubric), strict: true },
    },
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
  });

  const choice = completion.choices[0];
  const text = choice?.message?.content ?? "";

  if (!text.trim()) {
    throw new Error(
      `The report model returned no text (finish_reason: ${choice?.finish_reason ?? "unknown"})`,
    );
  }

  const parsed = JSON.parse(text) as Omit<
    GeneratedReport,
    "model" | "rubricVersionId" | "rubricVersion"
  >;
  return {
    ...parsed,
    model: REPORT_MODEL,
    rubricVersionId: rubric.id,
    rubricVersion: rubric.version,
  };
}
