import { sql } from "./db";

/** The clinic briefing, editable from the HR panel. */
export interface BriefSection {
  id: string;
  title: string;
  body: string;
  bullets: string[];
  sortOrder: number;
}

interface Row {
  id: string;
  title: string;
  body: string;
  bullets: string[];
  sort_order: number;
}

const toSection = (r: Row): BriefSection => ({
  id: r.id,
  title: r.title,
  body: r.body,
  bullets: r.bullets ?? [],
  sortOrder: r.sort_order,
});

export async function listBrief(assessmentId: string): Promise<BriefSection[]> {
  const rows = (await sql()`
    select * from brief_sections
    where assessment_id = ${assessmentId}
    order by sort_order, created_at`) as Row[];
  return rows.map(toSection);
}

export async function createSection(
  assessmentId: string,
  input: Partial<BriefSection>,
): Promise<BriefSection> {
  const rows = (await sql()`
    insert into brief_sections (assessment_id, title, body, bullets, sort_order)
    values (
      ${assessmentId}, ${input.title ?? "New section"}, ${input.body ?? ""}, ${input.bullets ?? []},
      coalesce((select max(sort_order) + 1 from brief_sections where assessment_id = ${assessmentId}), 0)
    ) returning *`) as Row[];
  return toSection(rows[0]);
}

export async function updateSection(
  id: string,
  input: Partial<BriefSection>,
): Promise<BriefSection | null> {
  const rows = (await sql()`
    update brief_sections set
      title = coalesce(${input.title ?? null}, title),
      body = coalesce(${input.body ?? null}, body),
      bullets = coalesce(${input.bullets ?? null}, bullets),
      sort_order = coalesce(${input.sortOrder ?? null}, sort_order)
    where id = ${id} returning *`) as Row[];
  return rows[0] ? toSection(rows[0]) : null;
}

export async function deleteSection(id: string): Promise<void> {
  await sql()`delete from brief_sections where id = ${id}`;
}

/** Compact form embedded in the patient agent's prompt. */
export function briefToText(sections: BriefSection[]): string {
  return sections
    .map((s) => {
      const bullets = s.bullets.length ? "\n" + s.bullets.map((b) => `- ${b}`).join("\n") : "";
      return `## ${s.title}\n${s.body}${bullets}`;
    })
    .join("\n\n");
}
