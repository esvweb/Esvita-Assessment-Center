import { listBrief } from "@/lib/brief";
import { getTranscript, setCallId } from "@/lib/db";
import { buildPatientPrompt } from "@/lib/prompt";
import { assessmentIdFor, errorResponse, patientFor, requireSession, HttpError } from "@/lib/session";
import { createCallAssistant, deleteAssistant } from "@/lib/vapi";

/**
 * Mints a one-shot Vapi assistant for the requested call and returns only its
 * id. The persona prompt stays server-side (see lib/vapi.ts).
 */
export async function POST(req: Request) {
  try {
    const { token, callNumber } = (await req.json()) as {
      token?: string;
      callNumber?: number;
    };
    const session = await requireSession(token);

    if (callNumber !== 1 && callNumber !== 2) {
      throw new HttpError(400, "callNumber must be 1 or 2");
    }
    const expected = callNumber === 1 ? "call_1" : "call_2";
    if (session.stage !== expected) {
      throw new HttpError(409, `This session is at the "${session.stage}" stage, not ${expected}`);
    }

    const assessmentId = await assessmentIdFor(session);
    const [patient, brief, history] = await Promise.all([
      patientFor(session),
      listBrief(assessmentId),
      getTranscript(session.id),
    ]);

    const systemPrompt = buildPatientPrompt({
      patient,
      brief,
      stage: expected,
      history,
      plan: session.plan,
      candidateName: session.candidate_name,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const serverUrl =
      appUrl && !appUrl.includes("localhost") ? `${appUrl}/api/vapi/webhook` : undefined;

    const assistantId = await createCallAssistant({
      patient,
      systemPrompt,
      callNumber,
      sessionId: session.id,
      serverUrl,
    });

    return Response.json({
      assistantId,
      publicKey: process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ?? null,
      patient: { name: patient.name, age: patient.age, country: patient.country },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Called when the browser ends a call: records the Vapi call id and cleans up. */
export async function DELETE(req: Request) {
  try {
    const { token, assistantId, callId, callNumber } = (await req.json()) as {
      token?: string;
      assistantId?: string;
      callId?: string;
      callNumber?: number;
    };
    const session = await requireSession(token);
    if (callId && (callNumber === 1 || callNumber === 2)) {
      await setCallId(session.id, callNumber, callId);
    }
    if (assistantId) await deleteAssistant(assistantId);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
