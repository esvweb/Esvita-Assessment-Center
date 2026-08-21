import { defaultAssessment } from "./assessments";
import { getCase, type PatientCase } from "./cases";
import { getSessionByToken } from "./db";
import type { AssessmentSession } from "./types";

/** Resolves a candidate token to its session, or throws a 404-shaped error. */
export async function requireSession(token: unknown): Promise<AssessmentSession> {
  if (typeof token !== "string" || token.length < 8) {
    throw new HttpError(400, "Missing or malformed session token");
  }
  const session = await getSessionByToken(token);
  if (!session) throw new HttpError(404, "No assessment found for this link");
  return session;
}

/**
 * Which assessment's content this session runs on. Sessions created before
 * assessments existed fall back to the default one.
 */
export async function assessmentIdFor(session: AssessmentSession): Promise<string> {
  if (session.assessment_id) return session.assessment_id;
  const fallback = await defaultAssessment();
  if (!fallback) throw new HttpError(500, "No assessment is configured");
  return fallback.id;
}

export async function patientFor(session: AssessmentSession): Promise<PatientCase> {
  const patient = await getCase(session.profile_id);
  if (!patient) throw new HttpError(500, `The case for this session (#${session.profile_id}) has been deleted`);
  return patient;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  const message = err instanceof Error ? err.message : "Unexpected error";
  return Response.json({ error: message }, { status: 500 });
}
