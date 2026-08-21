"use client";

import { useState } from "react";
import type { CallArtifacts } from "@/lib/vapi";
import type { TranscriptEntry } from "@/lib/types";

interface CallInfo {
  callId: string | null;
  artifacts: CallArtifacts | null;
}

interface Props {
  transcript: TranscriptEntry[];
  patientName: string;
  call1: CallInfo;
  call2: CallInfo;
}

const mmss = (s: number | null) =>
  s == null ? null : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;

/**
 * The reviewer's view of a session: each stage in its own panel, open by
 * default, with the call recording sitting inside the call it belongs to and the
 * messaging stage rendered as the chat it actually was.
 */
export default function TranscriptView({ transcript, patientName, call1, call2 }: Props) {
  const sections = [
    {
      key: "voice_1",
      title: "Call 1 — Discovery",
      subtitle: "Outbound · the candidate had to introduce themselves",
      call: call1,
    },
    { key: "chat", title: "Messaging", subtitle: "WhatsApp-style chat", call: null },
    { key: "voice_2", title: "Call 2 — Plan & closing", subtitle: null, call: call2 },
  ] as const;

  const [open, setOpen] = useState<Record<string, boolean>>({
    voice_1: true,
    chat: true,
    voice_2: true,
  });
  const allOpen = sections.every((s) => open[s.key]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Session record</h2>
        <button
          onClick={() =>
            setOpen(Object.fromEntries(sections.map((s) => [s.key, !allOpen])) as Record<string, boolean>)
          }
          className="text-sm font-medium text-brand"
        >
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>

      {sections.map((s) => {
        const entries = transcript.filter((e) => e.channel === s.key && e.speaker !== "system");
        const isOpen = open[s.key];

        return (
          <div key={s.key} className="overflow-hidden rounded-xl border border-line bg-white">
            <button
              onClick={() => setOpen((o) => ({ ...o, [s.key]: !o[s.key] }))}
              className="flex w-full items-center justify-between px-5 py-3.5 text-left"
            >
              <span>
                <span className="font-medium">{s.title}</span>
                {s.subtitle && <span className="ml-2 text-sm text-muted">{s.subtitle}</span>}
              </span>
              <span className="flex items-center gap-3 text-sm text-muted">
                {entries.length > 0 ? `${entries.length} turns` : "no record"}
                {s.call?.artifacts?.durationSeconds != null && (
                  <span>· {mmss(s.call.artifacts.durationSeconds)}</span>
                )}
                <span>{isOpen ? "−" : "+"}</span>
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-line">
                {s.call && (
                  <div className="border-b border-line bg-surface px-5 py-3">
                    {!s.call.callId && (
                      <p className="text-sm text-muted">This call did not take place.</p>
                    )}
                    {s.call.callId && s.call.artifacts?.hasRecording && (
                      <audio
                        controls
                        preload="none"
                        src={`/api/recordings/${s.call.callId}`}
                        className="w-full"
                      >
                        Your browser cannot play audio.
                      </audio>
                    )}
                    {s.call.callId && s.call.artifacts && !s.call.artifacts.hasRecording && (
                      <p className="text-sm text-muted">
                        The recording is not ready yet — it appears here once Vapi finishes
                        processing.
                      </p>
                    )}
                    {s.call.callId && !s.call.artifacts && (
                      <p className="text-sm text-muted">
                        Could not fetch the recording — check that VAPI_PRIVATE_KEY is set.
                      </p>
                    )}
                  </div>
                )}

                {entries.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-muted">Nothing was recorded at this stage.</p>
                ) : s.key === "chat" ? (
                  <ChatReplay entries={entries} patientName={patientName} />
                ) : (
                  <CallTranscript entries={entries} patientName={patientName} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function CallTranscript({
  entries,
  patientName,
}: {
  entries: TranscriptEntry[];
  patientName: string;
}) {
  return (
    <div className="space-y-2.5 px-5 py-4 text-sm">
      {entries.map((e) => (
        <p key={e.id} className="grid grid-cols-[6rem_1fr] gap-3">
          <span
            className={`text-right ${
              e.speaker === "candidate" ? "font-medium text-brand" : "font-medium text-muted"
            }`}
          >
            {e.speaker === "candidate" ? "Candidate" : patientName}
          </span>
          <span className="whitespace-pre-wrap">{e.text}</span>
        </p>
      ))}
    </div>
  );
}

/** The messaging stage shown as the conversation it was, not a flat log. */
function ChatReplay({
  entries,
  patientName,
}: {
  entries: TranscriptEntry[];
  patientName: string;
}) {
  return (
    <div className="space-y-3 bg-surface px-5 py-4">
      {entries.map((e) => {
        const mine = e.speaker === "candidate";
        const attachments = (e.attachments as string[] | undefined) ?? [];
        const isPlan = e.text.startsWith("TREATMENT PLAN SENT TO PATIENT");

        return (
          <div key={e.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[80%]">
              <p
                className={`mb-1 text-xs text-muted ${mine ? "text-right" : ""}`}
              >
                {mine ? "Candidate" : patientName}
              </p>
              <div
                className={`rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                  isPlan
                    ? "rounded-br-sm border border-brand/30 bg-white font-mono text-xs"
                    : mine
                      ? "rounded-br-sm bg-brand text-white"
                      : "rounded-bl-sm border border-line bg-white"
                }`}
              >
                {e.text}
                {attachments.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {attachments.map((src) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={src}
                        src={src}
                        alt="Patient photo"
                        className="h-24 w-full rounded-lg border border-line bg-white object-cover"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
