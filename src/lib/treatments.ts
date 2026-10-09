import { sql } from "./db";

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
  isActive?: boolean;
  sortOrder?: number;
}

export async function createTreatment(
  assessmentId: string,
  input: TreatmentInput,
): Promise<Treatment> {
  const rows = (await sql()`
    insert into treatments (assessment_id, name, min_price, currency, unit, is_active, sort_order)
    values (
      ${assessmentId}, ${input.name ?? "New treatment"}, ${input.minPrice ?? 0},
      ${input.currency ?? "EUR"}, ${input.unit ?? "unit"}, ${input.isActive ?? true},
      coalesce((select max(sort_order) + 1 from treatments where assessment_id = ${assessmentId}), 0)
    ) returning *`) as Row[];
  return toTreatment(rows[0]);
}

export async function updateTreatment(
  id: string,
  input: TreatmentInput,
): Promise<Treatment | null> {
  const rows = (await sql()`
    update treatments set
      name      = coalesce(${input.name ?? null}, name),
      min_price = coalesce(${input.minPrice ?? null}, min_price),
      currency  = coalesce(${input.currency ?? null}, currency),
      unit      = coalesce(${input.unit ?? null}, unit),
      is_active = coalesce(${input.isActive ?? null}, is_active),
      sort_order = coalesce(${input.sortOrder ?? null}, sort_order)
    where id = ${id} returning *`) as Row[];
  return rows[0] ? toTreatment(rows[0]) : null;
}

export async function deleteTreatment(id: string): Promise<void> {
  await sql()`delete from treatments where id = ${id}`;
}
