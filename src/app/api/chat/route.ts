import type OpenAI from "openai";
import { loadBanks, loadObjections } from "@/lib/banks";
import { listBrief } from "@/lib/brief";
import { appendTranscript, getTranscript, markPhotosRequested } from "@/lib/db";
import { CHAT_MODEL, openai } from "@/lib/openai";
import { buildPatientPrompt } from "@/lib/prompt";
import { loadBlocks } from "@/lib/prompt-blocks";
import { assessmentIdFor, errorResponse, patientFor, requireSession, HttpError } from "@/lib/session";

/**
 * One messaging turn with the patient.
 *
 * The patient can send case photos, but only by calling the send_photos tool —
 * which is how we know, reliably, that the candidate actually asked for them.
 * A description of photos in prose does not count and is not scored as a hit.
 */

const SEND_PHOTOS: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "send_photos",
    description:
      "Send the photos of your case to the person you are messaging. Call this only after they have asked you for photos or x-rays. Sends every photo you have on your phone in one go, as a real patient would.",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description:
            "The short text you send along with the photos, in your own voice. One sentence.",
        },
      },
      required: ["message"],
      additionalProperties: false,
    },
  },
};

export async function POST(req: Request) {
  try {
    const { token, message } = (await req.json()) as { token?: string; message?: string };
    const session = await requireSession(token);

    if (session.stage !== "chat" && session.stage !== "plan") {
      throw new HttpError(409, `Messaging is not open at the "${session.stage}" stage`);
    }
    if (typeof message !== "string" || !message.trim()) {
      throw new HttpError(400, "Empty message");
    }

    const assessmentId = await assessmentIdFor(session);
    const [patient, brief, history, blocks, banks, objections] = await Promise.all([
      patientFor(session),
      listBrief(assessmentId),
      getTranscript(session.id),
      loadBlocks(assessmentId),
      loadBanks(assessmentId),
      loadObjections(assessmentId),
    ]);

    // Everything before the chat stage becomes narrative context in the system
    // prompt; the chat itself becomes the real message array.
    const chatTurns = history.filter((e) => e.channel === "chat");
    const priorContext = history.filter((e) => e.channel !== "chat");

    const system = buildPatientPrompt({
      patient,
      brief,
      blocks,
      banks,
      objections,
      stage: "chat",
      history: priorContext,
      plan: session.plan,
      candidateName: session.candidate_name,
    });

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: system },
    ];
    for (const turn of chatTurns) {
      const text = turn.attachments?.length
        ? `${turn.text} [sent ${turn.attachments.length} photos]`
        : turn.text;
      if (!text.trim()) continue;
      messages.push({
        role: turn.speaker === "candidate" ? "user" : "assistant",
        content: text,
      });
    }
    messages.push({ role: "user", content: message.trim() });

    const client = openai();
    const request = {
      model: CHAT_MODEL,
      max_completion_tokens: 1024,
      // Chat Completions rejects function tools combined with reasoning on the
      // gpt-5 series. Reasoning buys nothing here anyway — these are short,
      // in-character replies where latency is what the candidate feels.
      reasoning_effort: "none" as const,
      tools: [SEND_PHOTOS],
      messages,
    };

    let completion = await client.chat.completions.create(request);
    let attachments: string[] = [];

    // The patient gets at most one tool round-trip per turn — it either sends
    // the photos or it does not.
    const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
    if (toolCall && "function" in toolCall && toolCall.function.name === "send_photos") {
      attachments = patient.photos.map((ph) => ph.url);
      await markPhotosRequested(session.id);

      messages.push(completion.choices[0].message);
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: `Sent ${attachments.length} photos: ${patient.photos
          .map((ph) => ph.caption)
          .join("; ")}`,
      });

      completion = await client.chat.completions.create({ ...request, messages });
    }

    const reply = (completion.choices[0]?.message?.content ?? "").trim();

    await appendTranscript([
      { session_id: session.id, channel: "chat", speaker: "candidate", text: message.trim() },
      {
        session_id: session.id,
        channel: "chat",
        speaker: "patient",
        text: reply || "(sent photos)",
        attachments: attachments.length ? attachments : undefined,
      },
    ]);

    return Response.json({
      reply,
      attachments,
      photos: attachments.length ? patient.photos : [],
    });
  } catch (err) {
    return errorResponse(err);
  }
}
