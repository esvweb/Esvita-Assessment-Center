import { neon } from "@neondatabase/serverless";
import { PRICE_LIST } from "./price-list.mjs";

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
      ([name, price, unit], order) => sql`
        insert into treatments (assessment_id, name, min_price, currency, unit, sort_order)
        values (${a.id}, ${name}, ${price}, 'EUR', ${unit}, ${order})`,
    ),
  );
  console.log(`  ✓ ${a.name}: ${PRICE_LIST.length} treatments seeded`);
}

console.log("Done.");
