import { CandidateAuthError, verifyCandidate } from "@/lib/candidate-auth";
import { errorResponse, HttpError } from "@/lib/session";

/**
 * Candidate sign-in. A single six-character code is the whole credential, so
 * failed attempts are throttled by code and by address.
 */
export async function POST(req: Request) {
  try {
    const { code } = (await req.json()) as { code?: string };
    if (!code?.trim()) throw new HttpError(400, "Enter your assessment code");

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "";

    let session;
    try {
      session = await verifyCandidate(code, ip);
    } catch (e) {
      if (e instanceof CandidateAuthError) throw new HttpError(e.status, e.message);
      throw e;
    }

    if (!session) throw new HttpError(401, "That code is not recognised");

    return Response.json({ ok: true, token: session.token, name: session.candidate_name });
  } catch (err) {
    return errorResponse(err);
  }
}
