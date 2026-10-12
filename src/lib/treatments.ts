import { sql } from "./db";
import { asSpecialty, type Specialty } from "./types";

/**
 * The priced treatment catalogue an assessment offers.
 *
 * The candidate picks lines from this list rather than typing free text, which
 * is what makes the quote comparable between candidates: everyone starts from
 * the same floor price and is scored on how far above it they sell, not on
 * whether they happened to remember a number from the briefing.
 */

export interface Treatment {
  id: string;
  assessmentId: string;
  name: string;
  /** The floor. A candidate may quote above it, never below. */
  minPrice: number;
  currency: string;
  unit: string;
  /** Lines in one group are alternatives to each other (brands, materials). */
  category: string | null;
  /** A dental case only offers dental lines, a hair case only hair ones. */
  specialty: Specialty;
  isActive: boolean;
  sortOrder: number;
}

interface Row {
  id: string;
  assessment_id: string;
  name: string;
  min_price: string | number;
  currency: string;
  unit: string;
  category: string | null;
  specialty: string;
  is_active: boolean;
  sort_order: number;
}

const toTreatment = (r: Row): Treatment => ({
  id: r.id,
  assessmentId: r.assessment_id,
  name: r.name,
  minPrice: Number(r.min_price),
  currency: r.currency,
  unit: r.unit,
  category: r.category,
  specialty: asSpecialty(r.specialty),
  isActive: r.is_active,
  sortOrder: r.sort_order,
});

export async function listTreatments(
  assessmentId: string,
  includeInactive = false,
): Promise<Treatment[]> {
  const db = sql();
  const rows = (
    includeInactive
      ? await db`select * from treatments where assessment_id = ${assessmentId} order by sort_order, name`
      : await db`select * from treatments where assessment_id = ${assessmentId} and is_active order by sort_order, name`
  ) as Row[];
  return rows.map(toTreatment);
}

export interface TreatmentInput {
  name?: string;
  minPrice?: number;
  currency?: string;
  unit?: string;
  /** Pass null or an empty string to clear it. */
  category?: string | null;
  specialty?: Specialty;
  isActive?: boolean;
  sortOrder?: number;
}

export async function createTreatment(
  assessmentId: string,
  input: TreatmentInput,
): Promise<Treatment> {
  const rows = (await sql()`
    insert into treatments (assessment_id, name, min_price, currency, unit, category, specialty, is_active, sort_order)
    values (
      ${assessmentId}, ${input.name ?? "New treatment"}, ${input.minPrice ?? 0},
      ${input.currency ?? "EUR"}, ${input.unit ?? "unit"}, ${input.category?.trim() || null},
      ${asSpecialty(input.specialty)}, ${input.isActive ?? true},
      coalesce((select max(sort_order) + 1 from treatments where assessment_id = ${assessmentId}), 0)
    ) returning *`) as Row[];
  return toTreatment(rows[0]);
}

export async function updateTreatment(
  id: string,
  input: TreatmentInput,
): Promise<Treatment | null> {
  const db = sql();
  const before = (await db`select name, assessment_id from treatments where id = ${id}`) as {
    name: string;
    assessment_id: string;
  }[];
  if (!before[0]) return null;

  const setsCategory = input.category !== undefined;
  const rows = (await db`
    update treatments set
      name      = coalesce(${input.name ?? null}, name),
      min_price = coalesce(${input.minPrice ?? null}, min_price),
      currency  = coalesce(${input.currency ?? null}, currency),
      unit      = coalesce(${input.unit ?? null}, unit),
      category  = case when ${setsCategory} then ${input.category?.trim() || null} else category end,
      specialty = coalesce(${input.specialty ? asSpecialty(input.specialty) : null}, specialty),
      is_active = coalesce(${input.isActive ?? null}, is_active),
      sort_order = coalesce(${input.sortOrder ?? null}, sort_order)
    where id = ${id} returning *`) as Row[];

  // Dentist's plans refer to price-list lines by name, so a rename is carried
  // into them. Without this, renaming a line in the panel would quietly drop it
  // from every plan that used it and the upsell figures would shift.
  const renamed = input.name?.trim();
  if (renamed && renamed !== before[0].name) {
    await db`
      update cases set doctor_plan_items = (
        select coalesce(jsonb_agg(
          case when e->>'treatment' = ${before[0].name}
               then jsonb_set(e, '{treatment}', to_jsonb(${renamed}::text))
               else e end
          order by ord), '[]'::jsonb)
        from jsonb_array_elements(doctor_plan_items) with ordinality as x(e, ord))
      where assessment_id = ${before[0].assessment_id}
        and doctor_plan_items @> ${JSON.stringify([{ treatment: before[0].name }])}::jsonb`;
  }

  return rows[0] ? toTreatment(rows[0]) : null;
}

export async function deleteTreatment(id: string): Promise<void> {
  await sql()`delete from treatments where id = ${id}`;
}
