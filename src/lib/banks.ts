export { objectionMap, type QuestionBank } from "./bank-types";
import type { QuestionBank } from "./bank-types";
import { sql } from "./db";
import { OBJECTION_BANK, TECHNICAL_BANKS, type TechnicalBank } from "./personas";

/**
 * The shared question and objection banks, moved out of code so they can be
 * edited per assessment. The constants in personas.ts remain the seed: an
 * assessment with no rows falls back to them, and saving copies the whole bank
 * into the database from then on.
 */

export const DEFAULT_BANKS: QuestionBank[] = (
  Object.keys(TECHNICAL_BANKS) as TechnicalBank[]
).map((key) => ({
  key,
  title: TECHNICAL_BANKS[key].title,
  questions: TECHNICAL_BANKS[key].questions,
}));

export const DEFAULT_OBJECTIONS: QuestionBank = {
  key: "objections",
  title: "Objection bank",
  questions: Object.entries(OBJECTION_BANK).map(([k, v]) => `${k} :: ${v}`),
};

interface Row {
  key: string;
  title: string;
  questions: string[];
}

export async function loadBanks(assessmentId: string): Promise<QuestionBank[]> {
  const rows = (await sql()`
    select key, title, questions from question_banks
    where assessment_id = ${assessmentId} order by sort_order, key`) as Row[];

  const stored = new Map(rows.map((r) => [r.key, r]));
  const merged = DEFAULT_BANKS.map((b) => stored.get(b.key) ?? b);
  // Banks the panel added beyond the seeded four.
  for (const r of rows) if (!merged.some((b) => b.key === r.key) && r.key !== "objections") merged.push(r);
  return merged;
}

export async function loadObjections(assessmentId: string): Promise<QuestionBank> {
  const rows = (await sql()`
    select key, title, questions from question_banks
    where assessment_id = ${assessmentId} and key = 'objections' limit 1`) as Row[];
  return rows[0] ?? DEFAULT_OBJECTIONS;
}

export async function saveBank(
  assessmentId: string,
  key: string,
  title: string,
  questions: string[],
): Promise<void> {
  await sql()`
    insert into question_banks (assessment_id, key, title, questions, sort_order)
    values (
      ${assessmentId}, ${key}, ${title}, ${questions},
      coalesce((select sort_order from question_banks
                where assessment_id = ${assessmentId} and key = ${key}), 99)
    )
    on conflict (assessment_id, key)
    do update set title = excluded.title, questions = excluded.questions, updated_at = now()`;
}

export async function resetBank(assessmentId: string, key: string): Promise<void> {
  await sql()`delete from question_banks where assessment_id = ${assessmentId} and key = ${key}`;
}
