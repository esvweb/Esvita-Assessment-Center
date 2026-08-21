import { getSessionById, getTranscript, setStage, sql } from "@/lib/db";
import { listBrief } from "@/lib/brief";
import { getCase } from "@/lib/cases";
import { generateReport } from "@/lib/report";
import { getAssessment } from "@/lib/assessments";
import { activeRubric, DEFAULT_CRITERIA, DEFAULT_INSTRUCTIONS, saveRubric } from "@/lib/rubric";
import { requirePermission } from "@/lib/permissions";
import { assessmentIdFor, errorResponse, requireSession, HttpError } from "@/lib/session";

/**
 * Generates (or regenerates) the HR report for a session.
 * Candidates trigger it implicitly by finishing; HR can re-run it by session id.
 */
export async function POST(req: Request) {
  try {
    const { token, sessionId } = (await req.json()) as { token?: string; sessionId?: string };

    const session = sessionId
      ? await (async () => {
          await requirePermission("runAssessments");
          const s = await getSessionById(sessionId);
          if (!s) throw new HttpError(404, "Session not found");
          return s;
        })()
      : await requireSession(token);

    const assessmentId = await assessmentIdFor(session);
    const [patient, brief, transcript] = await Promise.all([
      getCase(session.profile_id),
      listBrief(assessmentId),
      getTranscript(session.id),
    ]);
    if (!patient) throw new HttpError(400, "The case for this session has been deleted, so no report can be generated");

    // An assessment that has never had its rubric edited grades on the defaults,
    // saved as v1 so the report can still point at the exact criteria it used.
    const rubric =
      (await activeRubric(assessmentId)) ??
      (await saveRubric({
        assessmentId,
        criteria: DEFAULT_CRITERIA,
        instructions: DEFAULT_INSTRUCTIONS,
        note: "Created automatically from the default criteria",
      }));
    if (transcript.filter((e) => e.speaker === "candidate").length < 3) {
      throw new HttpError(400, "Not enough of the session was completed to grade it");
    }

    const assessment = await getAssessment(assessmentId);
    const report = await generateReport(
      session,
      patient,
      brief,
      rubric,
      transcript,
      assessment?.briefEnabled ?? true,
    );

    await sql()`
      insert into reports (
        session_id, outcome, scores, overall, hire_signal, markdown, model, rubric_version_id
      )
      values (
        ${session.id}, ${report.outcome}, ${JSON.stringify(report.scores)}::jsonb,
        ${report.overall}, ${report.hire_signal}, ${report.markdown}, ${report.model},
        ${report.rubricVersionId}
      )
      on conflict (session_id) do update set
        outcome     = excluded.outcome,
        scores      = excluded.scores,
        overall     = excluded.overall,
        hire_signal = excluded.hire_signal,
        markdown    = excluded.markdown,
        model       = excluded.model,
        rubric_version_id = excluded.rubric_version_id,
        created_at  = now()`

    // A candidate-triggered run closes the session out.
    if (!sessionId && session.stage !== "done") await setStage(session.id, "done");

    return Response.json({
      ok: true,
      outcome: report.outcome,
      overall: report.overall,
      rubricVersion: report.rubricVersion,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
