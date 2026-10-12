import type { TreatmentPlan } from "./types";

/**
 * Prices the dentist's plan and compares the candidate's plan against it.
 *
 * Pure on purpose — the case editor runs it in the browser for a live total,
 * and the report and session view run it on the server. The grader is handed
 * these figures rather than asked to work them out: an LLM doing arithmetic
 * over a twenty-line plan is where a report quietly goes wrong.
 *
 * The comparison is by *group*, not by line. A dentist prescribes "four All-on
 * implants"; which brand is the candidate's sale. Comparing line by line would
 * read Implance → Straumann as one treatment dropped and another added beyond
 * the indication — the opposite of what happened.
 */

export interface CatalogueEntry {
  name: string;
  minPrice: number;
  currency: string;
  unit: string;
  /** Lines in one group are alternatives to each other (brands, materials). */
  category: string | null;
}

export interface DoctorPlanItem {
  treatment: string;
  quantity: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

const toNumber = (v: string | number | undefined) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const groupOf = (name: string, entry: CatalogueEntry | undefined) =>
  entry?.category?.trim() || name;

// ---- the dentist's plan ----

export interface PricedLine {
  treatment: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  /** False when the line names something no longer in the price list. */
  known: boolean;
}

export interface PricedPlan {
  lines: PricedLine[];
  total: number;
  currency: string;
}

export function priceDoctorPlan(
  items: DoctorPlanItem[],
  catalogue: CatalogueEntry[],
): PricedPlan {
  const byName = new Map(catalogue.map((t) => [t.name, t]));
  const lines = items.map((it) => {
    const t = byName.get(it.treatment);
    const quantity = toNumber(it.quantity);
    const unitPrice = t?.minPrice ?? 0;
    return {
      treatment: it.treatment,
      quantity,
      unit: t?.unit ?? "",
      unitPrice,
      total: round(quantity * unitPrice),
      known: Boolean(t),
    };
  });
  return {
    lines,
    total: round(lines.reduce((s, l) => s + l.total, 0)),
    currency: catalogue[0]?.currency ?? "EUR",
  };
}

// ---- the comparison ----

export type UpsellTag =
  | "as indicated"
  | "higher-priced alternative"
  | "lower-priced alternative"
  | "more units"
  | "fewer units"
  | "priced above list"
  | "added beyond indication"
  | "missing from plan";

export interface UpsellRow {
  group: string;
  doctorItems: string[];
  doctorQuantity: number;
  doctorValue: number;
  candidateItems: string[];
  candidateQuantity: number;
  /** The candidate's lines at list price. */
  candidateListValue: number;
  /** The candidate's lines at the prices they actually quoted. */
  candidateQuotedValue: number;
  /** Selling above list: quoted − list. */
  markup: number;
  /** Matched units × (candidate's list price − doctor's list price). */
  alternative: number;
  /** Units beyond the indication, at the candidate's list price. */
  added: number;
  /** Indicated units the candidate dropped, at the doctor's list price. */
  missing: number;
  tags: UpsellTag[];
}

export interface UpsellAnalysis {
  rows: UpsellRow[];
  currency: string;
  doctorTotal: number;
  candidateTotal: number;
  /** candidateTotal − doctorTotal = markup + alternative + added − missing */
  delta: number;
  deltaPercent: number | null;
  markup: number;
  alternative: number;
  added: number;
  missing: number;
  /** Lines that matched nothing in the price list. */
  unpriced: string[];
}

interface Bucket {
  doctorItems: Set<string>;
  doctorQuantity: number;
  doctorValue: number;
  candidateItems: Set<string>;
  candidateQuantity: number;
  candidateListValue: number;
  candidateQuotedValue: number;
}

export function analyseUpsell(
  doctorItems: DoctorPlanItem[],
  plan: TreatmentPlan | null,
  catalogue: CatalogueEntry[],
): UpsellAnalysis {
  const byName = new Map(catalogue.map((t) => [t.name, t]));
  const buckets = new Map<string, Bucket>();
  const unpriced = new Set<string>();
  const order: string[] = [];

  const bucket = (group: string) => {
    let b = buckets.get(group);
    if (!b) {
      b = {
        doctorItems: new Set(),
        doctorQuantity: 0,
        doctorValue: 0,
        candidateItems: new Set(),
        candidateQuantity: 0,
        candidateListValue: 0,
        candidateQuotedValue: 0,
      };
      buckets.set(group, b);
      order.push(group);
    }
    return b;
  };

  for (const it of doctorItems) {
    const t = byName.get(it.treatment);
    if (!t) unpriced.add(it.treatment);
    const q = toNumber(it.quantity);
    const b = bucket(groupOf(it.treatment, t));
    b.doctorItems.add(it.treatment);
    b.doctorQuantity += q;
    b.doctorValue += q * (t?.minPrice ?? 0);
  }

  for (const it of plan?.items ?? []) {
    if (!it.treatment.trim()) continue;
    const t = byName.get(it.treatment);
    const q = toNumber(it.quantity);
    const quoted = toNumber(it.unit_price);
    // A line outside the price list (free text from an older plan) has no
    // floor to measure against, so it counts at its own price.
    if (!t) unpriced.add(it.treatment);
    const list = t?.minPrice ?? quoted;
    const b = bucket(groupOf(it.treatment, t));
    b.candidateItems.add(it.treatment);
    b.candidateQuantity += q;
    b.candidateListValue += q * list;
    b.candidateQuotedValue += q * quoted;
  }

  const rows: UpsellRow[] = order.map((group) => {
    const b = buckets.get(group)!;
    const matched = Math.min(b.doctorQuantity, b.candidateQuantity);
    const doctorUnit = b.doctorQuantity ? b.doctorValue / b.doctorQuantity : 0;
    const candidateUnit = b.candidateQuantity ? b.candidateListValue / b.candidateQuantity : 0;

    const markup = b.candidateQuotedValue - b.candidateListValue;
    const alternative = matched * (candidateUnit - doctorUnit);
    const added = (b.candidateQuantity - matched) * candidateUnit;
    const missing = (b.doctorQuantity - matched) * doctorUnit;

    const tags: UpsellTag[] = [];
    if (b.doctorQuantity && !b.candidateQuantity) tags.push("missing from plan");
    else if (!b.doctorQuantity && b.candidateQuantity) tags.push("added beyond indication");
    else {
      if (round(alternative) > 0) tags.push("higher-priced alternative");
      if (round(alternative) < 0) tags.push("lower-priced alternative");
      if (b.candidateQuantity > b.doctorQuantity) tags.push("more units");
      if (b.candidateQuantity < b.doctorQuantity) tags.push("fewer units");
    }
    if (round(markup) > 0) tags.push("priced above list");
    if (!tags.length) tags.push("as indicated");

    return {
      group,
      doctorItems: [...b.doctorItems],
      doctorQuantity: b.doctorQuantity,
      doctorValue: round(b.doctorValue),
      candidateItems: [...b.candidateItems],
      candidateQuantity: b.candidateQuantity,
      candidateListValue: round(b.candidateListValue),
      candidateQuotedValue: round(b.candidateQuotedValue),
      markup: round(markup),
      alternative: round(alternative),
      added: round(added),
      missing: round(missing),
      tags,
    };
  });

  const sum = (k: "doctorValue" | "candidateQuotedValue" | "markup" | "alternative" | "added" | "missing") =>
    round(rows.reduce((s, r) => s + r[k], 0));

  const doctorTotal = sum("doctorValue");
  const candidateTotal = sum("candidateQuotedValue");
  const delta = round(candidateTotal - doctorTotal);

  return {
    rows,
    currency: plan?.currency || catalogue[0]?.currency || "EUR",
    doctorTotal,
    candidateTotal,
    delta,
    deltaPercent: doctorTotal ? round((delta / doctorTotal) * 100) : null,
    markup: sum("markup"),
    alternative: sum("alternative"),
    added: sum("added"),
    missing: sum("missing"),
    unpriced: [...unpriced],
  };
}

// ---- for the grader ----

const money = (n: number, c: string) =>
  `${n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("en-GB", { maximumFractionDigits: 2 })} ${c}`;

/** The analysis as the grader reads it: computed figures, not a sum to do. */
export function upsellToText(a: UpsellAnalysis): string {
  const c = a.currency;
  const rows = a.rows.map((r) => {
    const doctor = r.doctorQuantity
      ? `${r.doctorQuantity} × ${r.doctorItems.join(" / ")} = ${money(r.doctorValue, c)}`
      : "—";
    const candidate = r.candidateQuantity
      ? `${r.candidateQuantity} × ${r.candidateItems.join(" / ")} = ${money(r.candidateQuotedValue, c)} quoted (${money(r.candidateListValue, c)} at list)`
      : "—";
    return `- ${r.group}: dentist ${doctor} | candidate ${candidate} | ${r.tags.join(", ")}`;
  });

  return [
    `Dentist's plan at list price: ${money(a.doctorTotal, c)}`,
    `Candidate's plan as quoted: ${money(a.candidateTotal, c)}`,
    `Difference: ${money(a.delta, c)}${a.deltaPercent == null ? "" : ` (${a.deltaPercent > 0 ? "+" : ""}${a.deltaPercent}%)`}`,
    ``,
    `Where the difference comes from (these four add up to it exactly):`,
    `- Priced above list: ${money(a.markup, c)}`,
    `- Alternatives chosen within a group (brand, material, technique): ${money(a.alternative, c)}`,
    `- Treatment added beyond the indication: ${money(a.added, c)}`,
    `- Indicated treatment the candidate left out: −${money(a.missing, c)}`,
    ``,
    `By treatment group:`,
    ...rows,
    ...(a.unpriced.length
      ? [``, `Not in the price list, so priced at face value or zero: ${a.unpriced.join("; ")}`]
      : []),
  ].join("\n");
}
