import { sql } from "./db";

/**
 * The grading rubric, versioned and append-only.
 *
 * Saving never overwrites: each save inserts a new version that becomes the
 * active one, and every earlier edition stays readable. Reports record the
 * version that produced them, so an old score can always be explained by the
 * criteria that were in force at the time.
 */

export interface Criterion {
  key: string;
  label: string;
  description: string;
}

export interface RubricVersion {
  id: string;
  assessmentId: string;
  version: number;
  criteria: Criterion[];
  instructions: string;
  note: string;
  createdBy: string;
  createdAt: string;
}

interface Row {
  id: string;
  assessment_id: string;
  version: number;
  criteria: Criterion[];
  instructions: string;
  note: string;
  created_by: string;
  created_at: string;
}

const toVersion = (r: Row): RubricVersion => ({
  id: r.id,
  assessmentId: r.assessment_id,
  version: r.version,
  criteria: r.criteria ?? [],
  instructions: r.instructions,
  note: r.note,
  createdBy: r.created_by,
  createdAt: r.created_at,
});

/** Newest first — the first entry is the active rubric. */
export async function listRubricVersions(assessmentId: string): Promise<RubricVersion[]> {
  const rows = (await sql()`
    select * from rubric_versions
    where assessment_id = ${assessmentId}
    order by version desc`) as Row[];
  return rows.map(toVersion);
}

export async function activeRubric(assessmentId: string): Promise<RubricVersion | null> {
  const rows = (await sql()`
    select * from rubric_versions
    where assessment_id = ${assessmentId}
    order by version desc limit 1`) as Row[];
  return rows[0] ? toVersion(rows[0]) : null;
}

export async function saveRubric(input: {
  assessmentId: string;
  criteria: Criterion[];
  instructions: string;
  note?: string;
  createdBy?: string;
}): Promise<RubricVersion> {
  const next = (await sql()`
    select coalesce(max(version), 0) + 1 as v from rubric_versions
    where assessment_id = ${input.assessmentId}`) as { v: number }[];

  const rows = (await sql()`
    insert into rubric_versions (assessment_id, version, criteria, instructions, note, created_by)
    values (
      ${input.assessmentId}, ${next[0].v}, ${JSON.stringify(input.criteria)}::jsonb,
      ${input.instructions}, ${input.note ?? ""}, ${input.createdBy ?? ""}
    ) returning *`) as Row[];
  return toVersion(rows[0]);
}

/** The criteria the seven-point report shipped with. */
export const DEFAULT_CRITERIA: Criterion[] = [
  {
    key: "communication",
    label: "Communication",
    description:
      "Fluency; clarity; confidence; grammar (professionalism, not perfection); speaking pace; ability to explain complex things simply. Note filler-word overuse, rambling, or jargon-dumping.",
  },
  {
    key: "discovery",
    label: "Discovery Skills",
    description:
      "Did they ask the right questions for this case? List items as COVERED / MISSED / N/A — only contextually relevant omissions count as MISSED, and coverage count alone must not drive the score. Weigh quality, timing and depth; whether questions followed the conversation's natural flow or felt like an interrogation checklist; tone of questioning.",
  },
  {
    key: "active_listening",
    label: "Active Listening",
    description:
      "Did they confirm understanding (paraphrasing, summarising)? Did they catch visible concerns AND the partially hidden ones? List every planted hidden signal and whether it was picked up or missed.",
  },
  {
    key: "objection_handling",
    label: "Objection Handling",
    description:
      "Per objection in the chain: state it, summarise the response, rate RESOLVED / PARTIAL / UNRESOLVED. Note discount panic, defensiveness, script recycling, or genuine reframing.",
  },
  {
    key: "technical_knowledge",
    label: "Technical Knowledge",
    description:
      "Per technical question asked: correct / partially correct / incorrect / avoided. Flag any dangerous misinformation separately. Where the case is an ethics test, state explicitly whether medical risk was raised proactively.",
  },
  {
    key: "sales_structure",
    label: "Sales Structure",
    description:
      "Did they follow the process naturally: Greeting/Introduction → Discovery → Understand needs → Educate → Handle objections → Create urgency → Close? Note which stages were present, skipped or out of order, and whether they built bonding where the opportunity appeared.",
  },
  {
    key: "upsell_performance",
    label: "Upsell & Plan Value",
    description:
      "Compare the dentist's indicated plan value with what the candidate actually quoted. Did they add legitimate value the patient benefits from, and explain it — or leave money on the table by quoting at/below the indication or discounting unasked? Flag overselling separately: proposing treatment the dentist did not indicate, inflating quantities without clinical grounds, or selling past a medical hold is a failure regardless of the revenue. Give the doctor's figure, the candidate's figure, and the difference in absolute and percentage terms.",
  },
  {
    key: "closing_ability",
    label: "Closing Ability",
    description:
      "Did they move the patient forward at each step (photo commitment in call 1, a concrete next step in call 2 — video call, reservation, deposit framing)? Did they ask for the next step at all, or wait passively?",
  },
];

export const DEFAULT_INSTRUCTIONS = `
## HOW TO GRADE

Score each criterion 1–5 (1 = poor, 3 = acceptable, 5 = excellent) and justify every score in 2–4 sentences, quoting or paraphrasing transcript moments as evidence.

Call 1 was an OUTBOUND cold call: the clinic rang the patient, who was not expecting it and did not recognise the number. Judge the opening on that basis — did the candidate introduce themselves and the clinic, give a reason for the call, and earn permission to continue before asking anything?

## REQUIRED MARKDOWN TEMPLATE

**Candidate:** … · **Profile used:** … · **Date:** … · **Session outcome:** CLOSED / WARM-CLOSE / LOST

Then one numbered section per criterion, in the order listed above, each with its score out of 5 and its justification.

**Overall score:** …
**Top 2 strengths:** …
**Top 2 development areas:** …
**Hire signal:** STRONG YES / YES / BORDERLINE / NO — one-paragraph rationale.
`.trim();
