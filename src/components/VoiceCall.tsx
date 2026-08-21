"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";

type Line = { speaker: "candidate" | "patient"; text: string };
type Phase = "idle" | "connecting" | "live" | "saving" | "ended" | "error";

interface Props {
  token: string;
  callNumber: 1 | 2;
  patientName: string;
  onFinished: () => void;
  preview?: boolean;
}

export default function VoiceCall({
  token,
  callNumber,
  patientName,
  onFinished,
  preview = false,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [partial, setPartial] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [patientSpeaking, setPatientSpeaking] = useState(false);

  const vapiRef = useRef<Vapi | null>(null);
  const linesRef = useRef<Line[]>([]);
  const assistantIdRef = useRef<string | null>(null);
  const callIdRef = useRef<string | null>(null);
  const finishedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const channel = callNumber === 1 ? "voice_1" : "voice_2";

  useEffect(() => {
    if (phase !== "live") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, partial]);

  /** Persist the captured turns, release the Vapi assistant, then advance. */
  const finish = useCallback(async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setPhase("saving");

    try {
      if (linesRef.current.length) {
        await fetch("/api/transcript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            entries: linesRef.current.map((l) => ({
              channel,
              speaker: l.speaker,
              text: l.text,
            })),
          }),
        });
      }

      await fetch("/api/voice", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          assistantId: assistantIdRef.current,
          callId: callIdRef.current,
          callNumber,
        }),
      });

      setPhase("ended");
      onFinished();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the call");
      setPhase("error");
    }
  }, [token, channel, callNumber, onFinished]);

  const start = useCallback(async () => {
    setError(null);
    setPhase("connecting");
    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, callNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start the call");
      if (!data.publicKey) throw new Error("NEXT_PUBLIC_VAPI_PUBLIC_KEY is not configured");

      assistantIdRef.current = data.assistantId;

      const vapi = new Vapi(data.publicKey);
      vapiRef.current = vapi;

      vapi.on("call-start", () => setPhase("live"));
      vapi.on("speech-start", () => setPatientSpeaking(true));
      vapi.on("speech-end", () => setPatientSpeaking(false));

      vapi.on("message", (msg: unknown) => {
        const m = msg as {
          type?: string;
          role?: string;
          transcriptType?: string;
          transcript?: string;
        };
        if (m.type !== "transcript" || !m.transcript) return;

        const speaker: Line["speaker"] = m.role === "user" ? "candidate" : "patient";
        if (m.transcriptType === "final") {
          const line = { speaker, text: m.transcript.trim() };
          linesRef.current = [...linesRef.current, line];
          setLines(linesRef.current);
          setPartial("");
        } else {
          setPartial(m.transcript);
        }
      });

      vapi.on("error", (e: unknown) => {
        const message =
          typeof e === "object" && e && "message" in e
            ? String((e as { message: unknown }).message)
            : "Call error";
        setError(message);
        setPhase("error");
      });

      vapi.on("call-end", () => {
        void finish();
      });

      const call = await vapi.start(data.assistantId);
      if (call?.id) callIdRef.current = call.id;
    } catch (e) {
      // A raw network error string means nothing to a candidate mid-assessment.
      const raw = e instanceof Error ? e.message : "";
      const networkish = /fetch failed|unreachable|NetworkError|Failed to fetch|timeout/i.test(raw);
      setError(
        networkish
          ? "We couldn't reach the call service. Check your connection and try again — your progress is saved."
          : raw || "Could not start the call",
      );
      setPhase("error");
    }
  }, [token, callNumber, finish]);

  const hangUp = useCallback(() => {
    void vapiRef.current?.stop();
  }, []);

  useEffect(() => {
    return () => {
      void vapiRef.current?.stop();
    };
  }, []);

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-line bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium tracking-widest text-muted uppercase">
              {callNumber === 1 ? "Call 1 — Outbound discovery" : "Call 2 — Plan & closing"}
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              {callNumber === 1 ? `Call ${patientName}` : `Call ${patientName} back`}
            </h2>
          </div>
          {phase === "live" && (
            <div className="flex items-center gap-2 text-sm">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  patientSpeaking ? "animate-pulse bg-brand" : "bg-line"
                }`}
              />
              <span className="font-mono tabular-nums text-muted">{mmss}</span>
            </div>
          )}
        </div>

        {phase === "idle" && preview && (
          <div className="mt-4 space-y-4">
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Preview mode — no real call is placed. For a live call, set the Vapi keys in
              <code className="mx-1">.env.local</code> and open a candidate link.
            </p>
            <button
              onClick={onFinished}
              className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
            >
              Skip this stage →
            </button>
          </div>
        )}

        {phase === "idle" && !preview && (
          <>
            <p className="mt-4 text-sm text-muted">
              {callNumber === 1
                ? `You are calling ${patientName}. They are not expecting this call and will not recognise the number — to them it is an unknown foreign number ringing. They will simply pick up. Introducing yourself, saying which clinic you are from and giving them a reason to keep listening is entirely on you. Use headphones if you can.`
                : `You prepared a treatment plan and sent it over. Now call ${patientName} back, walk them through it, answer their questions and try to move them forward. Your plan is in the panel beside you.`}
            </p>
            <button
              onClick={start}
              className="mt-5 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
            >
              {callNumber === 1 ? `Call ${patientName}` : "Start the call"}
            </button>
            <p className="mt-3 text-xs text-muted">
              Your browser will ask for microphone access. The call is recorded and transcribed for
              assessment.
            </p>
          </>
        )}

        {phase === "connecting" && (
          <p className="mt-4 text-sm text-muted">Dialling…</p>
        )}

        {phase === "live" && (
          <button
            onClick={hangUp}
            className="mt-5 rounded-lg border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            End call
          </button>
        )}

        {phase === "saving" && <p className="mt-4 text-sm text-muted">Saving the call…</p>}

        {phase === "error" && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => {
                finishedRef.current = false;
                setPhase("idle");
              }}
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {(lines.length > 0 || partial) && (
        <div
          ref={scrollRef}
          className="max-h-80 overflow-y-auto rounded-xl border border-line bg-white p-5"
        >
          <p className="mb-3 text-xs font-medium tracking-widest text-muted uppercase">
            Live transcript
          </p>
          <div className="space-y-2 text-sm">
            {lines.map((l, i) => (
              <p key={i}>
                <span
                  className={l.speaker === "candidate" ? "font-medium text-brand" : "font-medium"}
                >
                  {l.speaker === "candidate" ? "You" : patientName}:
                </span>{" "}
                <span className="text-ink">{l.text}</span>
              </p>
            ))}
            {partial && <p className="text-muted italic">{partial}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
