import { sql } from "./db";

/**
 * An assessment is the container for everything content-related: its own patient
 * cases, its own clinic briefing and its own grading rubric. Adding a second one
 * (hair transplant, for example) never touches the first.
 */
export interface Assessment {
  id: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
  /** When false the candidate never sees the clinic briefing or the side panel. */
  briefEnabled: boolean;
  createdAt: string;
  /** Counts for the panel listing. */
  caseCount?: number;
  sessionCount?: number;
  rubricVersion?: number | null;
}

interface Row {
  id: string;
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
  brief_enabled: boolean;
  created_at: string;
  case_count?: number;
  session_count?: number;
  rubric_version?: number | null;
}

const toAssessment = (r: Row): Assessment => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  description: r.description,
  isActive: r.is_active,
  briefEnabled: r.brief_enabled,
  createdAt: r.created_at,
  caseCount: r.case_count,
  sessionCount: r.session_count,
  rubricVersion: r.rubric_version ?? null,
});

export async function listAssessments(): Promise<Assessment[]> {
  const rows = (await sql()`
    select a.*,
      (select count(*)::int from cases c where c.assessment_id = a.id) as case_count,
      (select count(*)::int from sessions s where s.assessment_id = a.id) as session_count,
      (select max(version) from rubric_versions r where r.assessment_id = a.id) as rubric_version
    from assessments a
    order by a.created_at`) as Row[];
  return rows.map(toAssessment);
}

export async function getAssessment(id: string): Promise<Assessment | null> {
  // Same aggregates as the list, so a single fetch is never missing counts.
  const rows = (await sql()`
    select a.*,
      (select count(*)::int from cases c where c.assessment_id = a.id) as case_count,
      (select count(*)::int from sessions s where s.assessment_id = a.id) as session_count,
      (select max(version) from rubric_versions r where r.assessment_id = a.id) as rubric_version
    from assessments a
    where a.id = ${id} limit 1`) as Row[];
  return rows[0] ? toAssessment(rows[0]) : null;
}

/** The assessment new invitations default to when none is chosen. */
export async function defaultAssessment(): Promise<Assessment | null> {
  const rows = (await sql()`
    select * from assessments where is_active order by created_at limit 1`) as Row[];
  return rows[0] ? toAssessment(rows[0]) : null;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
      .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "assessment"
  );
}

export async function createAssessment(input: {
  name: string;
  description?: string;
}): Promise<Assessment> {
  const base = slugify(input.name);
  // Slugs are unique; fall back to a suffix rather than failing the create.
  const taken = (await sql()`select slug from assessments where slug like ${base + "%"}`) as {
    slug: string;
  }[];
  const slug = taken.some((t) => t.slug === base) ? `${base}-${taken.length + 1}` : base;

  const rows = (await sql()`
    insert into assessments (name, slug, description)
    values (${input.name}, ${slug}, ${input.description ?? ""})
    returning *`) as Row[];
  return toAssessment(rows[0]);
}

export async function updateAssessment(
  id: string,
  input: { name?: string; description?: string; isActive?: boolean; briefEnabled?: boolean },
): Promise<Assessment | null> {
  const rows = (await sql()`
    update assessments set
      name = coalesce(${input.name ?? null}, name),
      description = coalesce(${input.description ?? null}, description),
      is_active = coalesce(${input.isActive ?? null}, is_active),
      brief_enabled = coalesce(${input.briefEnabled ?? null}, brief_enabled)
    where id = ${id} returning *`) as Row[];
  return rows[0] ? toAssessment(rows[0]) : null;
}

/**
 * Copies an assessment's content into a new one: every case with its photos,
 * every briefing section, and the active rubric as the copy's v1. Sessions and
 * reports are deliberately not copied — they belong to the original run.
 */
export async function duplicateAssessment(
  sourceId: string,
  name: string,
): Promise<Assessment | null> {
  const source = await getAssessment(sourceId);
  if (!source) return null;

  const copy = await createAssessment({
    name,
    description: source.description,
  });
  await sql()`update assessments set brief_enabled = ${source.briefEnabled} where id = ${copy.id}`;

  const db = sql();

  // Cases keep their own ids, so map old → new to re-attach the photos.
  const cases = (await db`
    insert into cases (
      assessment_id, name, age, country, headline, situation, personality, case_plan,
      hidden_signals, objection_chain, extra_questions, technical_banks,
      special_rule, extra_prompt, doctor_indication, doctor_plan_value, doctor_plan_currency,
      voice_id, accent, pickup_line, is_active, sort_order
    )
    select
      ${copy.id}, name, age, country, headline, situation, personality, case_plan,
      hidden_signals, objection_chain, extra_questions, technical_banks,
      special_rule, extra_prompt, doctor_indication, doctor_plan_value, doctor_plan_currency,
      voice_id, accent, pickup_line, is_active, sort_order
    from cases where assessment_id = ${sourceId}
    order by sort_order, id
    returning id, sort_order, name`) as { id: number; sort_order: number; name: string }[];

  const originals = (await db`
    select id, sort_order, name from cases where assessment_id = ${sourceId}
    order by sort_order, id`) as { id: number; sort_order: number; name: string }[];

  for (const [i, original] of originals.entries()) {
    const target = cases[i];
    if (!target) continue;
    await db`
      insert into case_photos (case_id, caption, mime_type, bytes, size_bytes, sort_order)
      select ${target.id}, caption, mime_type, bytes, size_bytes, sort_order
      from case_photos where case_id = ${original.id}`;
  }

  await db`
    insert into brief_sections (assessment_id, title, body, bullets, sort_order)
    select ${copy.id}, title, body, bullets, sort_order
    from brief_sections where assessment_id = ${sourceId}`;

  await db`
    insert into rubric_versions (assessment_id, version, criteria, instructions, note, created_by)
    select ${copy.id}, 1, criteria, instructions,
           ${`Copied from "${source.name}"`}, created_by
    from rubric_versions where assessment_id = ${sourceId}
    order by version desc limit 1`;

  // The price list comes along, otherwise the copy has nothing for a candidate
  // to quote from and the plan stage is unusable until someone notices.
  await db`
    insert into treatments (assessment_id, name, min_price, currency, unit, is_active, sort_order)
    select ${copy.id}, name, min_price, currency, unit, is_active, sort_order
    from treatments where assessment_id = ${sourceId}`;

  // Only blocks and banks the source actually overrode exist as rows; the rest
  // keep falling back to the built-in defaults, which is what the copy wants.
  await db`
    insert into prompt_blocks (assessment_id, key, body)
    select ${copy.id}, key, body
    from prompt_blocks where assessment_id = ${sourceId}`;

  await db`
    insert into question_banks (assessment_id, key, title, questions, sort_order)
    select ${copy.id}, key, title, questions, sort_order
    from question_banks where assessment_id = ${sourceId}`;

  return getAssessment(copy.id);
}
