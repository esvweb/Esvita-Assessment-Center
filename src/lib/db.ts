import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { STAGE_ORDER, type AssessmentSession, type Stage, type TranscriptEntry, type TreatmentPlan } from "./types";

/**
 * Server-only Neon access.
 *
 * Every query in this app runs on the server against DATABASE_URL. Candidates
 * are authenticated by an unguessable token in their URL and HR users by a
 * signed session cookie — the browser never talks to Postgres, so there is no
 * row-level security to configure.
 *
 * All queries are tagged templates, so every interpolated value is sent as a
 * bound parameter and never concatenated into SQL.
 */
let cached: NeonQueryFunction<false, false> | null = null;

export function sql(): NeonQueryFunction<false, false> {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Database is not configured. Set DATABASE_URL to your Neon connection string in .env.local",
    );
  }
  cached = neon(url);
  return cached;
}

export async function getSessionByToken(token: string): Promise<AssessmentSession | null> {
  const db = sql();
  const rows = await db`select * from sessions where token = ${token} limit 1`;
  return (rows[0] as AssessmentSession) ?? null;
}

export async function getSessionById(id: string): Promise<AssessmentSession | null> {
  const db = sql();
  const rows = await db`select * from sessions where id = ${id} limit 1`;
  return (rows[0] as AssessmentSession) ?? null;
}

export async function getTranscript(sessionId: string): Promise<TranscriptEntry[]> {
  const db = sql();
  const rows = await db`
    select * from transcript where session_id = ${sessionId} order by seq asc`;
  return rows as TranscriptEntry[];
}

export async function appendTranscript(entries: TranscriptEntry[]): Promise<void> {
  if (!entries.length) return;
  const db = sql();
  // Unnest keeps this a single round trip while still binding every value.
  await db`
    insert into transcript (session_id, channel, speaker, text, attachments)
    select * from unnest(
      ${entries.map((e) => e.session_id)}::uuid[],
      ${entries.map((e) => e.channel)}::text[],
      ${entries.map((e) => e.speaker)}::text[],
      ${entries.map((e) => e.text)}::text[],
      ${entries.map((e) => (e.attachments ? JSON.stringify(e.attachments) : null))}::jsonb[]
    )`;
}

/**
 * Moves the session to a stage and remembers the furthest one reached, so a
 * candidate can step back to a call or the chat and then return without losing
 * their place.
 */
export async function setStage(sessionId: string, stage: Stage): Promise<void> {
  const db = sql();
  const current = await getSessionById(sessionId);
  const furthest = Math.max(
    STAGE_ORDER.indexOf(stage),
    STAGE_ORDER.indexOf(current?.max_stage ?? current?.stage ?? "brief"),
  );
  const maxStage = STAGE_ORDER[Math.max(furthest, 0)];
  const status = maxStage === "done" ? "completed" : "in_progress";

  await db`
    update sessions set
      stage        = ${stage},
      max_stage    = ${maxStage},
      status       = ${status},
      started_at   = case when ${stage} = 'call_1' and started_at is null then now() else started_at end,
      completed_at = case when ${maxStage} = 'done' and completed_at is null then now() else completed_at end
    where id = ${sessionId}`;
}

export async function savePlan(sessionId: string, plan: TreatmentPlan): Promise<void> {
  const db = sql();
  await db`update sessions set plan = ${JSON.stringify(plan)}::jsonb where id = ${sessionId}`;
}

export async function markPhotosRequested(sessionId: string): Promise<void> {
  const db = sql();
  await db`update sessions set photos_requested = true where id = ${sessionId}`;
}

export async function setCallId(sessionId: string, which: 1 | 2, callId: string): Promise<void> {
  const db = sql();
  if (which === 1) {
    await db`update sessions set call_1_id = ${callId} where id = ${sessionId}`;
  } else {
    await db`update sessions set call_2_id = ${callId} where id = ${sessionId}`;
  }
}

export async function countTranscriptRows(sessionId: string, channel: string): Promise<number> {
  const db = sql();
  const rows = await db`
    select count(*)::int as n from transcript
    where session_id = ${sessionId} and channel = ${channel}`;
  return (rows[0] as { n: number }).n;
}
