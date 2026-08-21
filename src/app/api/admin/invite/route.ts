import { randomBytes } from "crypto";
import { isSignedIn } from "@/lib/auth";
import { sql } from "@/lib/db";
import { defaultAssessment, getAssessment } from "@/lib/assessments";
import { getCase, listCases, pickCaseId } from "@/lib/cases";
import { errorResponse, HttpError } from "@/lib/session";

/** Creates a candidate invitation and returns the link to send them. */
export async function POST(req: Request) {
  try {
    if (!(await isSignedIn())) throw new HttpError(401, "You need to sign in");

    const { candidate_name, candidate_email, profile_id, assessment_id } =
      (await req.json()) as {
        candidate_name?: string;
        candidate_email?: string;
        profile_id?: number | "auto";
        assessment_id?: string;
      };

    if (!candidate_name?.trim()) throw new HttpError(400, "Candidate name is required");

    // "auto" rotates profiles evenly so results stay comparable across candidates.
    const db = sql();
    const assessment = assessment_id
      ? await getAssessment(assessment_id)
      : await defaultAssessment();
    if (!assessment) throw new HttpError(400, "Assessment not found");

    if (!(await listCases(assessment.id)).length) {
      throw new HttpError(400, `"${assessment.name}" has no active cases — add one first`);
    }

    let resolved: number;
    if (profile_id === "auto" || profile_id == null) {
      const rows = await db`
        select count(*)::int as n from sessions where assessment_id = ${assessment.id}`;
      resolved = await pickCaseId(assessment.id, (rows[0] as { n: number }).n);
    } else {
      const chosen = await getCase(profile_id);
      if (!chosen || chosen.assessmentId !== assessment.id) {
        throw new HttpError(400, `Case #${profile_id} does not belong to this assessment`);
      }
      resolved = chosen.id;
    }

    const token = randomBytes(24).toString("base64url");

    // With the briefing switched off there is nothing to read first, so the
    // session opens straight on the outbound call.
    const startStage = assessment.briefEnabled ? "brief" : "call_1";

    const inserted = await db`
      insert into sessions (
        token, assessment_id, candidate_name, candidate_email, profile_id, stage, max_stage
      )
      values (
        ${token},
        ${assessment.id},
        ${candidate_name.trim()},
        ${candidate_email?.trim() || null},
        ${resolved},
        ${startStage},
        ${startStage}
      )
      returning *`;

    const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
    return Response.json({ session: inserted[0], link: `${base}/a/${token}` });
  } catch (err) {
    return errorResponse(err);
  }
}

