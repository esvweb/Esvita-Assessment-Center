import { neon } from "@neondatabase/serverless";
import { PRICE_LIST, PRICING_NOTES } from "./price-list.mjs";

/**
 * Seeds the priced catalogue from the clinic's price list (db/price-list.mjs).
 * Runs only against assessments that have no priced lines yet, so it is safe
 * to re-run and never overwrites what the panel has edited.
 */

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = neon(url);

const assessments = await sql`select id, name from assessments order by created_at`;

for (const a of assessments) {
  const [{ count }] = await sql`
    select count(*)::int as count from treatments where assessment_id = ${a.id}`;
  if (count > 0) {
    console.log(`  – ${a.name}: ${count} already priced, left alone`);
    continue;
  }
  await sql.transaction(
    PRICE_LIST.map(
      ([name, price, unit, category, specialty], order) => sql`
        insert into treatments (assessment_id, name, min_price, currency, unit, category, specialty, sort_order)
        values (${a.id}, ${name}, ${price}, 'EUR', ${unit}, ${category}, ${specialty}, ${order})`,
    ),
  );
  console.log(`  ✓ ${a.name}: ${PRICE_LIST.length} treatments seeded`);
}

// Pricing notes, likewise only where none have been written yet.
const noted = await sql`update assessments set pricing_notes = ${PRICING_NOTES}
  where pricing_notes = '' returning name`;
for (const a of noted) console.log(`  ✓ ${a.name}: pricing notes seeded`);

console.log("Done.");
