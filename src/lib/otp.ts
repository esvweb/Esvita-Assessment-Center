import { createHmac } from "crypto";
import { sql } from "./db";
import { randomCode, safeEqual } from "./auth";

/**
 * One-time login codes. Codes are stored hashed, expire after 10 minutes, are
 * single-use, and are rate limited per user so the endpoint cannot be used to
 * spam somebody's inbox or brute-forced once issued.
 */

const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_WINDOW = 5;
const WINDOW_MINUTES = 15;

function hash(code: string): string {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "").update(code).digest("hex");
}

export class OtpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function issueCode(userId: string): Promise<string> {
  const db = sql();
  const recent = await db`
    select count(*)::int as n from otp_codes
    where user_id = ${userId}
      and created_at > now() - (${WINDOW_MINUTES} || ' minutes')::interval`;
  const count = (recent[0] as { n: number }).n;

  if (count >= MAX_CODES_PER_WINDOW) {
    throw new OtpError(429, `Too many codes requested. Try again in ${WINDOW_MINUTES} minutes.`);
  }

  const code = randomCode(6);
  await db`
    insert into otp_codes (user_id, code_hash, expires_at)
    values (${userId}, ${hash(code)}, now() + (${TTL_MINUTES} || ' minutes')::interval)`;

  return code;
}

export async function verifyCode(userId: string, code: string): Promise<void> {
  const db = sql();
  const rows = await db`
    select * from otp_codes
    where user_id = ${userId} and consumed_at is null
    order by created_at desc limit 1`;

  const row =
    (rows[0] as { id: string; code_hash: string; expires_at: string; attempts: number }) ?? null;

  if (!row) throw new OtpError(400, "Request a sign-in code first.");
  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw new OtpError(400, "That code has expired. Request a new one.");
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    throw new OtpError(429, "Too many incorrect attempts. Request a new code.");
  }

  if (!safeEqual(hash(code.trim()), row.code_hash)) {
    await db`update otp_codes set attempts = attempts + 1 where id = ${row.id}`;
    throw new OtpError(401, "That code is not correct.");
  }

  await db`update otp_codes set consumed_at = now() where id = ${row.id}`;
}

export const OTP_TTL_MINUTES = TTL_MINUTES;
