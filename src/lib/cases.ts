import { sql } from "./db";
import type { TechnicalBank } from "./personas";

/**
 * Patient cases, loaded from the database so HR can edit them without a deploy.
 * The shape mirrors what the prompt builder needs; `personas.ts` now only holds
 * the shared question banks and the seed data.
 */

export interface CasePhoto {
  id: string;
  caption: string;
  url: string;
  sizeBytes: number;
}

export interface PatientCase {
  id: number;
  assessmentId: string;
  name: string;
  age: number | null;
  country: string | null;
  headline: string | null;
  situation: string | null;
  personality: string | null;
  casePlan: string | null;
  hiddenSignals: string[];
  objectionChain: string[];
  extraQuestions: string[];
  technicalBanks: TechnicalBank[];
  specialRule: string | null;
  extraPrompt: string | null;
  /** What the treating dentist prescribed after seeing the photos. */
  doctorIndication: string | null;
  /** The package value of the doctor's plan, for the upsell comparison. */
  doctorPlanValue: number | null;
  doctorPlanCurrency: string;
  voice: { voiceId: string; accent: string | null };
  /** What the patient says when they answer a call from an unknown number. */
  pickupLine: string;
  isActive: boolean;
  sortOrder: number;
  photos: CasePhoto[];
}

interface CaseRow {
  id: number;
  assessment_id: string;
  name: string;
  age: number | null;
  country: string | null;
  headline: string | null;
  situation: string | null;
  personality: string | null;
  case_plan: string | null;
  hidden_signals: string[];
  objection_chain: string[];
  extra_questions: string[];
  technical_banks: string[];
  special_rule: string | null;
  extra_prompt: string | null;
  doctor_indication: string | null;
  doctor_plan_value: string | number | null;
  doctor_plan_currency: string;
  voice_id: string;
  accent: string | null;
  pickup_line: string;
  is_active: boolean;
  sort_order: number;
}

function toCase(row: CaseRow, photos: CasePhoto[]): PatientCase {
  return {
    id: row.id,
    assessmentId: row.assessment_id,
    name: row.name,
    age: row.age,
    country: row.country,
    headline: row.headline,
    situation: row.situation,
    personality: row.personality,
    casePlan: row.case_plan,
    hiddenSignals: row.hidden_signals ?? [],
    objectionChain: row.objection_chain ?? [],
    extraQuestions: row.extra_questions ?? [],
    technicalBanks: (row.technical_banks ?? []) as TechnicalBank[],
    specialRule: row.special_rule,
    extraPrompt: row.extra_prompt,
    doctorIndication: row.doctor_indication,
    doctorPlanValue: row.doctor_plan_value == null ? null : Number(row.doctor_plan_value),
    doctorPlanCurrency: row.doctor_plan_currency ?? "EUR",
    voice: { voiceId: row.voice_id, accent: row.accent },
    pickupLine: row.pickup_line,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    photos,
  };
}

async function photosFor(caseIds: number[]): Promise<Map<number, CasePhoto[]>> {
  const map = new Map<number, CasePhoto[]>();
  if (!caseIds.length) return map;
  const rows = (await sql()`
    select id, case_id, caption, size_bytes
    from case_photos where case_id = any(${caseIds})
    order by case_id, sort_order`) as {
    id: string;
    case_id: number;
    caption: string;
    size_bytes: number;
  }[];
  for (const r of rows) {
    const list = map.get(r.case_id) ?? [];
    list.push({ id: r.id, caption: r.caption, url: `/api/photos/${r.id}`, sizeBytes: r.size_bytes });
    map.set(r.case_id, list);
  }
  return map;
}

export async function listCases(
  assessmentId: string,
  includeInactive = false,
): Promise<PatientCase[]> {
  const db = sql();
  const rows = (
    includeInactive
      ? await db`select * from cases where assessment_id = ${assessmentId} order by sort_order, id`
      : await db`select * from cases where assessment_id = ${assessmentId} and is_active order by sort_order, id`
  ) as CaseRow[];
  const photos = await photosFor(rows.map((r) => r.id));
  return rows.map((r) => toCase(r, photos.get(r.id) ?? []));
}

export async function getCase(id: number): Promise<PatientCase | null> {
  const rows = (await sql()`select * from cases where id = ${id} limit 1`) as CaseRow[];
  if (!rows[0]) return null;
  const photos = await photosFor([id]);
  return toCase(rows[0], photos.get(id) ?? []);
}

export type CaseInput = Partial<Omit<PatientCase, "id" | "photos" | "voice">> & {
  voiceId?: string;
  accent?: string | null;
};

export async function createCase(
  assessmentId: string,
  input: CaseInput,
): Promise<PatientCase> {
  const rows = (await sql()`
    insert into cases (
      assessment_id, name, age, country, headline, situation, personality, case_plan,
      hidden_signals, objection_chain, extra_questions, technical_banks,
      special_rule, extra_prompt, doctor_indication, doctor_plan_value, doctor_plan_currency,
      voice_id, accent, pickup_line, is_active, sort_order
    ) values (
      ${assessmentId}, ${input.name ?? "New case"}, ${input.age ?? null}, ${input.country ?? null},
      ${input.headline ?? null}, ${input.situation ?? null}, ${input.personality ?? null},
      ${input.casePlan ?? null}, ${input.hiddenSignals ?? []}, ${input.objectionChain ?? []},
      ${input.extraQuestions ?? []}, ${input.technicalBanks ?? []},
      ${input.specialRule ?? null}, ${input.extraPrompt ?? null},
      ${input.doctorIndication ?? null}, ${input.doctorPlanValue ?? null},
      ${input.doctorPlanCurrency ?? "EUR"},
      ${input.voiceId ?? "matilda"}, ${input.accent ?? null},
      ${input.pickupLine ?? "Hello?"}, ${input.isActive ?? true}, ${input.sortOrder ?? 99}
    ) returning *`) as CaseRow[];
  return toCase(rows[0], []);
}

export async function updateCase(id: number, input: CaseInput): Promise<PatientCase | null> {
  const current = await getCase(id);
  if (!current) return null;
  const v = { ...current, ...input };
  await sql()`
    update cases set
      name = ${v.name}, age = ${v.age}, country = ${v.country}, headline = ${v.headline},
      situation = ${v.situation}, personality = ${v.personality}, case_plan = ${v.casePlan},
      hidden_signals = ${v.hiddenSignals}, objection_chain = ${v.objectionChain},
      extra_questions = ${v.extraQuestions}, technical_banks = ${v.technicalBanks},
      special_rule = ${v.specialRule}, extra_prompt = ${v.extraPrompt},
      doctor_indication = ${v.doctorIndication},
      doctor_plan_value = ${v.doctorPlanValue},
      doctor_plan_currency = ${v.doctorPlanCurrency},
      voice_id = ${input.voiceId ?? current.voice.voiceId},
      accent = ${input.accent !== undefined ? input.accent : current.voice.accent},
      pickup_line = ${v.pickupLine}, is_active = ${v.isActive}, sort_order = ${v.sortOrder}
    where id = ${id}`;
  return getCase(id);
}

export async function deleteCase(id: number): Promise<void> {
  await sql()`delete from cases where id = ${id}`;
}

// ---- photos ----

export async function addPhoto(
  caseId: number,
  caption: string,
  mimeType: string,
  bytes: Buffer,
): Promise<CasePhoto> {
  const rows = (await sql()`
    insert into case_photos (case_id, caption, mime_type, bytes, size_bytes, sort_order)
    values (
      ${caseId}, ${caption}, ${mimeType}, ${bytes}, ${bytes.length},
      coalesce((select max(sort_order) + 1 from case_photos where case_id = ${caseId}), 0)
    ) returning id, caption, size_bytes`) as {
    id: string;
    caption: string;
    size_bytes: number;
  }[];
  const r = rows[0];
  return { id: r.id, caption: r.caption, url: `/api/photos/${r.id}`, sizeBytes: r.size_bytes };
}

export async function deletePhoto(id: string): Promise<void> {
  await sql()`delete from case_photos where id = ${id}`;
}

export async function getPhotoBytes(
  id: string,
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  const rows = (await sql()`select bytes, mime_type from case_photos where id = ${id} limit 1`) as {
    bytes: Buffer | Uint8Array;
    mime_type: string;
  }[];
  if (!rows[0]) return null;
  return { bytes: Buffer.from(rows[0].bytes), mimeType: rows[0].mime_type };
}

/** Rotates cases evenly across candidates so results stay comparable. */
export async function pickCaseId(assessmentId: string, seed: number): Promise<number> {
  const active = await listCases(assessmentId);
  if (!active.length) throw new Error("This assessment has no active cases");
  return active[seed % active.length].id;
}
