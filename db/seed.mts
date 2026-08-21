/**
 * Moves the content that used to be hardcoded — the seven patient cases and the
 * clinic briefing — into the database, where HR can edit it.
 *
 * Idempotent: does nothing if the tables already have rows, unless run with
 * --force, which replaces them.
 *
 * Run with: npm run db:seed
 */
import { readFileSync } from "fs";
import { join } from "path";
import { sql } from "../src/lib/db";
import { PROFILES } from "../src/lib/personas";
import { BRIEF } from "../src/lib/company";

const force = process.argv.includes("--force");
const db = sql();

// Everything seeded belongs to the first assessment; the schema creates it.
const assessments = (await db`select id, name from assessments order by created_at limit 1`) as {
  id: string;
  name: string;
}[];
if (!assessments[0]) throw new Error("Run db/schema.sql first — no assessment found");
const assessmentId = assessments[0].id;
console.log(`Assessment: ${assessments[0].name}\n`);

/**
 * How each patient answers a call from a number they do not recognise. Short and
 * a little guarded — the candidate has to introduce themselves and earn the
 * conversation, which is the point of an outbound call.
 */
const PICKUP: Record<number, string> = {
  1: "Hello?",
  2: "Yeah, hello?",
  3: "Yes? Who is this?",
  4: "Hello.",
  5: "Yes, hello?",
  6: "Yeah?",
  7: "Hello?",
};

async function seedCases() {
  const existing = (await db`select count(*)::int as n from cases`)[0] as { n: number };
  if (existing.n > 0 && !force) {
    console.log(`cases: ${existing.n} rows already exist, skipped (use --force to replace)`);
    return;
  }
  if (force) await db`delete from cases`;

  for (const p of PROFILES) {
    await db`
      insert into cases (
        id, assessment_id, name, age, country, headline, situation, personality, case_plan,
        hidden_signals, objection_chain, extra_questions, technical_banks,
        special_rule, voice_id, accent, pickup_line, sort_order
      ) values (
        ${p.id}, ${assessmentId}, ${p.name}, ${p.age}, ${p.country}, ${p.headline},
        ${p.situation}, ${p.personality}, ${p.casePlan},
        ${p.hiddenSignals}, ${p.objectionChain}, ${p.extraQuestions ?? []}, ${p.technicalBanks},
        ${p.specialRule ?? null}, ${p.voice.voiceId}, ${p.voice.accent},
        ${PICKUP[p.id] ?? "Hello?"}, ${p.id}
      )`;

    for (const [i, photo] of p.photos.entries()) {
      const file = join(process.cwd(), "public", photo.url.replace(/^\//, ""));
      let bytes: Buffer;
      try {
        bytes = readFileSync(file);
      } catch {
        console.log(`  ! photo not found, skipped: ${photo.url}`);
        continue;
      }
      await db`
        insert into case_photos (case_id, caption, mime_type, bytes, size_bytes, sort_order)
        values (${p.id}, ${photo.caption}, ${"image/svg+xml"}, ${bytes}, ${bytes.length}, ${i})`;
    }
    console.log(`  ✓ #${p.id} ${p.name} (${p.photos.length} photos)`);
  }

  // serial column: move the sequence past the ids we inserted by hand
  await db`select setval('cases_id_seq', (select max(id) from cases))`;
}

async function seedBrief() {
  const existing = (await db`select count(*)::int as n from brief_sections`)[0] as { n: number };
  if (existing.n > 0 && !force) {
    console.log(`brief_sections: ${existing.n} rows already exist, skipped`);
    return;
  }
  if (force) await db`delete from brief_sections`;

  for (const [i, s] of BRIEF.entries()) {
    await db`
      insert into brief_sections (assessment_id, title, body, bullets, sort_order)
      values (${assessmentId}, ${s.title}, ${s.body}, ${s.bullets ?? []}, ${i})`;
    console.log(`  ✓ ${s.title}`);
  }
}

console.log("Cases:");
await seedCases();
console.log("\nCompany information:");
await seedBrief();

// Seed the starting rubric so the criteria are visible and editable from day one.
const { DEFAULT_CRITERIA, DEFAULT_INSTRUCTIONS } = await import("../src/lib/rubric");
const rubrics = (await db`
  select count(*)::int as n from rubric_versions where assessment_id = ${assessmentId}`)[0] as {
  n: number;
};
if (rubrics.n === 0) {
  await db`
    insert into rubric_versions (assessment_id, version, criteria, instructions, note)
    values (${assessmentId}, 1, ${JSON.stringify(DEFAULT_CRITERIA)}::jsonb, ${DEFAULT_INSTRUCTIONS},
            ${"First version — default criteria"})`;
  console.log("\nGrading criteria: v1 created");
} else {
  console.log(`\nGrading criteria: ${rubrics.n} version(s) already exist, skipped`);
}

const c = (await db`select count(*)::int as n from cases`)[0] as { n: number };
const ph = (await db`select count(*)::int as n from case_photos`)[0] as { n: number };
const b = (await db`select count(*)::int as n from brief_sections`)[0] as { n: number };
console.log(`\nTotal: ${c.n} cases, ${ph.n} photos, ${b.n} briefing sections`);
