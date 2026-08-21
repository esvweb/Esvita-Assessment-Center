import { appendTranscript, getTranscript } from "@/lib/db";
import { errorResponse, requireSession } from "@/lib/session";
import type { Channel, Speaker } from "@/lib/types";

const CHANNELS: Channel[] = ["voice_1", "chat", "voice_2", "system"];
const SPEAKERS: Speaker[] = ["candidate", "patient", "system"];

/** Persists a batch of voice turns captured in the browser during a call. */
export async function POST(req: Request) {
  try {
    const { token, entries } = (await req.json()) as {
      token?: string;
      entries?: { channel: Channel; speaker: Speaker; text: string }[];
    };
    const session = await requireSession(token);

    const clean = (entries ?? [])
      .filter(
        (e) =>
          CHANNELS.includes(e.channel) &&
          SPEAKERS.includes(e.speaker) &&
          typeof e.text === "string" &&
          e.text.trim().length > 0,
      )
      .map((e) => ({
        session_id: session.id,
        channel: e.channel,
        speaker: e.speaker,
        text: e.text.trim(),
      }));

    await appendTranscript(clean);
    return Response.json({ ok: true, saved: clean.length });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get("token");
    const session = await requireSession(token);
    return Response.json({ entries: await getTranscript(session.id) });
  } catch (err) {
    return errorResponse(err);
  }
}
