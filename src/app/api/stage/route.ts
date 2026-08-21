import { appendTranscript, setStage } from "@/lib/db";
import { errorResponse, requireSession, HttpError } from "@/lib/session";
import { nextStage, STAGE_ORDER, type Stage } from "@/lib/types";

/**
 * Moves the session between stages.
 *
 * Forward is one step at a time; backward is free within the stages already
 * visited, so a candidate who clicks past a call or the chat by accident can go
 * back to it. Skipping ahead to an unvisited stage is still refused.
 */
export async function POST(req: Request) {
  try {
    const { token, to } = (await req.json()) as { token?: string; to?: Stage };
    const session = await requireSession(token);

    const target = to ?? nextStage(session.stage);
    const from = STAGE_ORDER.indexOf(session.stage);
    const dest = STAGE_ORDER.indexOf(target);
    const furthest = STAGE_ORDER.indexOf(session.max_stage ?? session.stage);

    if (dest < 0) throw new HttpError(400, `Unknown stage: ${target}`);
    if (dest === from) return Response.json({ stage: session.stage, changed: false });
    if (dest > from + 1 && dest > furthest) throw new HttpError(400, "Stages cannot be skipped");

    await setStage(session.id, target);

    // Only log genuine progress; stepping back and forth is navigation, not a
    // session event, and would clutter the transcript the grader reads.
    if (dest > furthest) {
      await appendTranscript([
        {
          session_id: session.id,
          channel: "system",
          speaker: "system",
          text: `Stage advanced: ${session.stage} → ${target}`,
        },
      ]);
    }

    return Response.json({
      stage: target,
      changed: true,
      maxStage: STAGE_ORDER[Math.max(dest, furthest)],
    });
  } catch (err) {
    return errorResponse(err);
  }
}
