import type { PatientCase } from "./cases";

/**
 * Server-side Vapi control plane.
 *
 * The persona prompt is deliberately never sent to the browser. We create a
 * short-lived Vapi assistant here, hand the browser only its id, and delete it
 * when the call ends — so a candidate cannot open devtools and read the scenario,
 * the hidden signals or the objection chain they are about to be tested on.
 */

const VAPI_API = "https://api.vapi.ai";

function privateKey(): string {
  const key = process.env.VAPI_PRIVATE_KEY;
  if (!key) throw new Error("VAPI_PRIVATE_KEY is not set");
  return key;
}

/** Retryable: the request never reached Vapi, or Vapi asked us to back off. */
function isTransient(status: number | null): boolean {
  return status === null || status === 429 || status >= 500;
}

const MAX_ATTEMPTS = 3;

/**
 * A dropped connection here lands in front of a candidate mid-assessment, so a
 * blip must not end their session. Network failures and 5xx/429 responses are
 * retried with backoff; a 4xx is a real error and fails immediately.
 *
 * Only connect-phase failures are retried, so a create that actually reached
 * Vapi is never issued twice.
 */
async function vapiFetch(path: string, init: RequestInit): Promise<unknown> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${VAPI_API}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${privateKey()}`,
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      lastError = err;
      if (attempt === MAX_ATTEMPTS) break;
      await new Promise((r) => setTimeout(r, 400 * 2 ** (attempt - 1)));
      continue;
    }

    if (res.ok) return res.status === 204 ? null : res.json();

    const body = await res.text();
    lastError = new Error(`Vapi ${init.method ?? "GET"} ${path} failed (${res.status}): ${body}`);
    if (!isTransient(res.status) || attempt === MAX_ATTEMPTS) throw lastError;
    await new Promise((r) => setTimeout(r, 400 * 2 ** (attempt - 1)));
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `Vapi is unreachable after ${MAX_ATTEMPTS} attempts (${init.method ?? "GET"} ${path}): ${detail}`,
  );
}

export interface CreateCallAssistantArgs {
  patient: PatientCase;
  systemPrompt: string;
  /** 1 = discovery call, 2 = plan + closing call */
  callNumber: 1 | 2;
  sessionId: string;
  serverUrl?: string;
}

/**
 * Builds the assistant Vapi is asked to create for one call.
 *
 * Nothing here is configured by hand in the Vapi dashboard — the persona, the
 * voice and the conversation so far are all assembled per call from the session,
 * which is why the patient remembers earlier stages and why the scenario never
 * reaches the browser. Kept separate from the POST so it can be inspected and
 * tested without touching the API.
 */
export function buildAssistantConfig(args: CreateCallAssistantArgs): Record<string, unknown> {
  const { patient, systemPrompt, callNumber, sessionId, serverUrl } = args;

  const body: Record<string, unknown> = {
    name: `esvita-${sessionId.slice(0, 8)}-call${callNumber}`,
    model: {
      provider: "openai",
      model: process.env.VAPI_VOICE_MODEL ?? "gpt-4.1",
      temperature: 0.8,
      maxTokens: 300,
      messages: [{ role: "system", content: systemPrompt }],
    },
    voice: {
      provider: "11labs",
      voiceId: patient.voice.voiceId,
      stability: 0.5,
      similarityBoost: 0.75,
    },
    transcriber: { provider: "deepgram", model: "nova-3", language: "en" },
    // Both calls are outbound: the clinic rings the patient. The patient only
    // answers the phone ("Hello?") — the candidate has to introduce themselves
    // and open the conversation, which is what call 1 measures.
    firstMessage: callNumber === 1 ? patient.pickupLine : "",
    firstMessageMode: callNumber === 1 ? "assistant-speaks-first" : "assistant-waits-for-user",
    maxDurationSeconds: callNumber === 1 ? 900 : 1500,
    silenceTimeoutSeconds: 30,
    backgroundSound: "off",
    // HR listens back to tone and pacing, which the transcript cannot carry.
    // Candidates are told the call is recorded before they accept it.
    artifactPlan: { recordingEnabled: true },
    clientMessages: ["transcript", "status-update", "speech-update", "conversation-update"],
    metadata: { sessionId, callNumber },
  };

  if (serverUrl) {
    body.server = {
      url: serverUrl,
      ...(process.env.VAPI_WEBHOOK_SECRET
        ? { headers: { "x-vapi-secret": process.env.VAPI_WEBHOOK_SECRET } }
        : {}),
    };
    body.serverMessages = ["end-of-call-report", "status-update"];
  }

  return body;
}

/** Creates a one-shot assistant for a single call and returns its id. */
export async function createCallAssistant(args: CreateCallAssistantArgs): Promise<string> {
  const created = (await vapiFetch("/assistant", {
    method: "POST",
    body: JSON.stringify(buildAssistantConfig(args)),
  })) as { id?: string };

  if (!created?.id) throw new Error("Vapi did not return an assistant id");
  return created.id;
}

/** Best-effort cleanup; a leftover assistant is harmless but clutters the dashboard. */
export async function deleteAssistant(assistantId: string): Promise<void> {
  try {
    await vapiFetch(`/assistant/${assistantId}`, { method: "DELETE" });
  } catch {
    // ignore — cleanup only
  }
}

export interface CallArtifacts {
  /** Whether a recording exists; it is streamed via /api/recordings/{callId}. */
  hasRecording: boolean;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
}

/**
 * Pulls a finished call's timing and whether a recording exists. The audio itself
 * is streamed through /api/recordings/{callId} rather than linked directly —
 * Vapi's storage is access-controlled, and proxying keeps both the private key
 * and the signed URL off the client.
 */
export async function getCallArtifacts(callId: string): Promise<CallArtifacts | null> {
  try {
    const call = (await vapiFetch(`/call/${callId}`, { method: "GET" })) as {
      recordingUrl?: string;
      artifact?: {
        presignedMonoUrl?: string;
        presignedStereoUrl?: string;
        presignedUrlsExpiresAt?: string;
        recordingUrl?: string;
      };
      startedAt?: string;
      endedAt?: string;
    };

    const hasRecording = Boolean(
      call.artifact?.presignedMonoUrl ?? call.artifact?.recordingUrl ?? call.recordingUrl,
    );

    const startedAt = call.startedAt ?? null;
    const endedAt = call.endedAt ?? null;
    const durationSeconds =
      startedAt && endedAt
        ? Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000)
        : null;

    return { hasRecording, startedAt, endedAt, durationSeconds };
  } catch (err) {
    console.error(`Could not fetch Vapi call ${callId}`, err);
    return null;
  }
}
