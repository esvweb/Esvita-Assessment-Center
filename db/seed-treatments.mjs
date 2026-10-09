import { neon } from "@neondatabase/serverless";

/**
 * Seeds the priced catalogue from the indicative prices in the company
 * briefing. Runs only against assessments that have no priced lines yet, so it
 * is safe to re-run and never overwrites what the panel has edited.
 */

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = neon(url);

const CATALOGUE = [
  ["Zirconia crown", 180, "unit"],
  ["E.max laminate veneer", 230, "unit"],
  ["Dental implant — Osstem", 450, "implant"],
  ["Dental implant — Nobel Biocare", 750, "implant"],
  ["Dental implant — Straumann", 900, "implant"],
  ["Multiunit abutment", 120, "abutment"],
  ["All-on-4, per jaw", 4200, "jaw"],
  ["All-on-6, per jaw", 5400, "jaw"],
  ["Bone graft", 300, "region"],
  ["Sinus lift", 600, "side"],
  ["Extraction", 50, "tooth"],
  ["Root canal", 120, "tooth"],
  ["Hair transplant FUE, up to 4,000 grafts", 2200, "procedure"],
  ["Hair transplant DHI, up to 4,000 grafts", 2700, "procedure"],
];

const assessments = await sql`select id, name from assessments order by created_at`;

for (const a of assessments) {
  const [{ count }] = await sql`
    select count(*)::int as count from treatments where assessment_id = ${a.id}`;
  if (count > 0) {
    console.log(`  – ${a.name}: ${count} already priced, left alone`);
    continue;
  }
  let order = 0;
  for (const [name, price, unit] of CATALOGUE) {
    await sql`
      insert into treatments (assessment_id, name, min_price, currency, unit, sort_order)
      values (${a.id}, ${name}, ${price}, 'EUR', ${unit}, ${order++})`;
  }
  console.log(`  ✓ ${a.name}: ${CATALOGUE.length} treatments seeded`);
}

console.log("Done.");
