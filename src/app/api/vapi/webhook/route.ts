import { appendTranscript, countTranscriptRows } from "@/lib/db";
import type { Channel } from "@/lib/types";

/**
 * Optional server-side capture of Vapi's end-of-call report.
 *
 * The browser already streams transcripts as the call happens (which is what
 * makes local development work without a public URL). This webhook is the
 * belt-and-braces path for production: if a candidate's tab crashes mid-call,
 * the authoritative transcript still lands here.
 */
export async function POST(req: Request) {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-vapi-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      message?: {
        type?: string;
        call?: { id?: string; metadata?: { sessionId?: string; callNumber?: number } };
        artifact?: { messages?: { role?: string; message?: string; time?: number }[] };
      };
    };
    const msg = body.message;
    if (msg?.type !== "end-of-call-report") return Response.json({ ok: true, ignored: true });

    const sessionId = msg.call?.metadata?.sessionId;
    const callNumber = msg.call?.metadata?.callNumber;
    if (!sessionId) return Response.json({ ok: true, ignored: "no sessionId in metadata" });

    // If the browser already saved this call, do not duplicate it.
    const channel: Channel = callNumber === 2 ? "voice_2" : "voice_1";
    if ((await countTranscriptRows(sessionId, channel)) > 0) {
      return Response.json({ ok: true, skipped: "already captured" });
    }

    const turns = (msg.artifact?.messages ?? [])
      .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "bot")
      .map((m) => ({
        session_id: sessionId,
        channel,
        speaker: (m.role === "user" ? "candidate" : "patient") as "candidate" | "patient",
        text: (m.message ?? "").trim(),
      }))
      .filter((m) => m.text.length > 0);

    await appendTranscript(turns);
    return Response.json({ ok: true, saved: turns.length });
  } catch (err) {
    console.error("Vapi webhook error", err);
    return new Response("error", { status: 500 });
  }
}
