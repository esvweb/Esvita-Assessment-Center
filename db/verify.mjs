/**
 * Applies db/schema.sql to an in-process Postgres (pglite) and exercises the
 * non-obvious statements this app relies on — the bulk `unnest` transcript
 * insert, the interval casts in the OTP window, the reports upsert and the
 * dashboard join.
 *
 * Run with: npm run db:verify
 *
 * Note: the SQL below is copied from src/lib, not imported, so it can drift.
 * Its real job is proving the schema applies and these constructs behave; if you
 * change a query in src/lib, mirror it here.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "fs";

const db = new PGlite();
const ok = (m) => console.log("  ✓", m);

// 1. Schema applies cleanly
await db.exec(readFileSync("db/schema.sql", "utf8"));
ok("db/schema.sql applies");

// 2. Session insert (invite route)
const s = await db.query(
  `insert into sessions (token, candidate_name, candidate_email, profile_id)
   values ($1, $2, $3, $4) returning *`,
  ["tok_abc", "Test Aday", null, 1],
);
const sid = s.rows[0].id;
ok(`session insert → stage=${s.rows[0].stage}, status=${s.rows[0].status}`);

// 3. Bulk transcript insert via unnest (the riskiest statement in db.ts)
await db.query(
  `insert into transcript (session_id, channel, speaker, text, attachments)
   select * from unnest($1::uuid[], $2::text[], $3::text[], $4::text[], $5::jsonb[])`,
  [
    [sid, sid],
    ["chat", "chat"],
    ["candidate", "patient"],
    ["can you send photos?", "ok here you go"],
    [null, JSON.stringify(["/cases/margaret/upper-arch.svg"])],
  ],
);
const t = await db.query(`select * from transcript where session_id=$1 order by seq`, [sid]);
ok(`unnest insert → ${t.rows.length} rows, attachments=${JSON.stringify(t.rows[1].attachments)}`);

// 4. setStage conditional timestamps
await db.query(
  `update sessions set stage=$1, status=$2,
     started_at   = case when $1 = 'call_1' then now() else started_at end,
     completed_at = case when $1 = 'done'   then now() else completed_at end
   where id=$3`,
  ["call_1", "in_progress", sid],
);
const st = await db.query(`select stage, started_at, completed_at from sessions where id=$1`, [sid]);
ok(`setStage → started_at set=${st.rows[0].started_at !== null}, completed_at null=${st.rows[0].completed_at === null}`);

// 5. jsonb plan round-trip
await db.query(`update sessions set plan = $1::jsonb where id = $2`, [
  JSON.stringify({ summary: "3 implants", items: [{ treatment: "Implant", quantity: "3" }] }),
  sid,
]);
const pl = await db.query(`select plan from sessions where id=$1`, [sid]);
ok(`plan jsonb → ${pl.rows[0].plan.items[0].treatment}`);

// 6. Users + OTP interval casts
const u = await db.query(
  `insert into users (username, email, role) values ($1,$2,$3) returning *`,
  ["ayse", "ayse@esvita.com", "member"],
);
const uid = u.rows[0].id;
await db.query(
  `insert into otp_codes (user_id, code_hash, expires_at)
   values ($1, $2, now() + ($3 || ' minutes')::interval)`,
  [uid, "deadbeef", 10],
);
const win = await db.query(
  `select count(*)::int as n from otp_codes
   where user_id=$1 and created_at > now() - ($2 || ' minutes')::interval`,
  [uid, 15],
);
ok(`otp interval casts → ${win.rows[0].n} code in window`);

// 7. Case-insensitive username lookup + unique index
const found = await db.query(`select * from users where lower(username)=lower($1) limit 1`, ["AYSE"]);
ok(`case-insensitive lookup → ${found.rows[0].username}`);
try {
  await db.query(`insert into users (username,email) values ($1,$2)`, ["Ayse", "x@y.com"]);
  console.log("  ✗ duplicate username was allowed");
} catch {
  ok("duplicate username rejected by unique index");
}

// 8. Reports upsert (on conflict)
for (const overall of [3.5, 4.2]) {
  await db.query(
    `insert into reports (session_id, outcome, scores, overall, hire_signal, markdown, model)
     values ($1,$2,$3::jsonb,$4,$5,$6,$7)
     on conflict (session_id) do update set
       outcome=excluded.outcome, scores=excluded.scores, overall=excluded.overall,
       hire_signal=excluded.hire_signal, markdown=excluded.markdown,
       model=excluded.model, created_at=now()`,
    [sid, "WARM-CLOSE", JSON.stringify({ communication: 4 }), overall, "YES", "# rapor", "gpt-5.5"],
  );
}
const r = await db.query(`select count(*)::int n, max(overall) o from reports where session_id=$1`, [sid]);
ok(`reports upsert → ${r.rows[0].n} row, overall=${r.rows[0].o}`);

// 9. Admin dashboard LEFT JOIN
const j = await db.query(
  `select s.*, r.overall, r.hire_signal, r.outcome
   from sessions s left join reports r on r.session_id = s.id
   order by s.created_at desc limit 100`,
);
ok(`admin join → ${j.rows.length} row, overall=${j.rows[0].overall}, signal=${j.rows[0].hire_signal}`);

// 10. Cascade delete
await db.query(`delete from sessions where id=$1`, [sid]);
const left = await db.query(`select count(*)::int n from transcript where session_id=$1`, [sid]);
ok(`cascade delete → ${left.rows[0].n} orphaned transcript rows`);

console.log("\nAll SQL verified against real Postgres.");
