import { randomInt } from "crypto";
import { sql } from "./db";
import type { AssessmentSession } from "./types";

/**
 * Candidate credentials.
 *
 * One six-character code does the work of both a username and a password:
 * five digits identify the person, and a trailing letter says which attempt this
 * is. Re-testing someone keeps their number and moves the letter on, so
 * `48213A` and `48213B` are the same candidate's first and second sessions.
 *
 * A short code is a small secret, so `verifyCandidate` is rate limited — see
 * `checkThrottle` below.
 */

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MAX_ATTEMPTS = 8;
const WINDOW_MINUTES = 15;

/** Groups a person's attempts: their email when known, otherwise their name. */
export function candidateKey(name: string, email?: string | null): string {
  return (email?.trim() || name.trim()).toLowerCase();
}

export class CandidateAuthError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Issues the next code for this candidate: a fresh five-digit number the first
 * time, or their existing number with the next letter on a re-test.
 */
export async function issueCandidateCode(key: string): Promise<string> {
  const db = sql();

  const existing = (await db`
    select candidate_code from sessions
    where candidate_key = ${key} and candidate_code is not null
    order by candidate_code`) as { candidate_code: string }[];

  if (existing.length) {
    const number = existing[0].candidate_code.slice(0, 5);
    const used = new Set(existing.map((r) => r.candidate_code.slice(5)));
    const next = [...LETTERS].find((l) => !used.has(l));
    if (!next) throw new Error(`Candidate ${number} has used all 26 attempt letters`);
    return `${number}${next}`;
  }

  // Find a five-digit number nobody holds yet.
  for (let i = 0; i < 40; i++) {
    const number = String(randomInt(10000, 100000));
    const clash = (await db`
      select 1 from sessions where candidate_code like ${number + "%"} limit 1`) as unknown[];
    if (!clash.length) return `${number}A`;
  }
  throw new Error("Could not allocate a candidate number");
}

async function checkThrottle(code: string, ip: string): Promise<void> {
  const db = sql();
  const rows = (await db`
    select
      count(*) filter (where code = ${code})::int as by_code,
      count(*) filter (where ip = ${ip} and ${ip} <> '')::int as by_ip
    from candidate_login_attempts
    where created_at > now() - (${WINDOW_MINUTES} || ' minutes')::interval`) as {
    by_code: number;
    by_ip: number;
  }[];

  const { by_code, by_ip } = rows[0];
  if (by_code >= MAX_ATTEMPTS || by_ip >= MAX_ATTEMPTS * 3) {
    throw new CandidateAuthError(
      429,
      `Too many attempts. Wait ${WINDOW_MINUTES} minutes and try again.`,
    );
  }
}

/** Verifies a candidate code, throttling repeated failures. */
export async function verifyCandidate(
  code: string,
  ip: string,
): Promise<AssessmentSession | null> {
  const normalised = code.trim().toUpperCase().replace(/\s|-/g, "");
  await checkThrottle(normalised, ip);

  const rows = (await sql()`
    select * from sessions where candidate_code = ${normalised} limit 1`) as AssessmentSession[];
  const session = rows[0] ?? null;

  if (!session) {
    await sql()`insert into candidate_login_attempts (code, ip) values (${normalised}, ${ip})`;
    return null;
  }
  return session;
}
