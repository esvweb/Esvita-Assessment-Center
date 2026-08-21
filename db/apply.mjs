/** Applies db/schema.sql to DATABASE_URL. Run with: npm run db:apply */
import { Pool, neonConfig } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// Node 22+ ships a global WebSocket; the pooled driver needs it for multi-statement SQL.
neonConfig.webSocketConstructor = globalThis.WebSocket;

const pool = new Pool({ connectionString: url });
try {
  await pool.query(readFileSync("db/schema.sql", "utf8"));
  const { rows } = await pool.query(
    `select table_name from information_schema.tables
     where table_schema = 'public' order by table_name`,
  );
  console.log("Schema applied. Tables:", rows.map((r) => r.table_name).join(", "));
} finally {
  await pool.end();
}
