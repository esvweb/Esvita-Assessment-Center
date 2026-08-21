"use client";

import { useCallback, useEffect, useState } from "react";
import Brief from "./Brief";
import Chat from "./Chat";
import Done from "./Done";
import PlanForm from "./PlanForm";
import Sidebar from "./Sidebar";
import VoiceCall from "./VoiceCall";
import type { BriefSection } from "@/lib/brief";
import type { DoctorIndication } from "./PlanForm";
import { STAGE_ORDER, type Stage, type TreatmentPlan } from "@/lib/types";

const STEPS: { stage: Stage; label: string }[] = [
  { stage: "brief", label: "Briefing" },
  { stage: "call_1", label: "Call 1" },
  { stage: "chat", label: "Messaging" },
  { stage: "plan", label: "Plan" },
  { stage: "call_2", label: "Call 2" },
];

/** Stages where the clinic reference panel is worth keeping on screen. */
const WITH_SIDEBAR: Stage[] = ["call_1", "chat", "plan", "call_2"];

interface ChatMsg {
  speaker: "candidate" | "patient";
  text: string;
  attachments?: string[];
}

interface Props {
  token: string;
  candidateName: string;
  patientName: string;
  initialStage: Stage;
  initialMaxStage: Stage;
  initialChat: ChatMsg[];
  brief: BriefSection[];
  briefEnabled: boolean;
  plan: TreatmentPlan | null;
  doctor?: DoctorIndication;
  preview?: boolean;
  previewPhotos?: { url: string; caption: string }[];
}

export default function Flow({
  token,
  candidateName,
  patientName,
  initialStage,
  initialMaxStage,
  initialChat,
  brief,
  briefEnabled,
  plan: initialPlan,
  doctor,
  preview = false,
  previewPhotos = [],
}: Props) {
  const [stage, setStage] = useState<Stage>(initialStage);
  const [maxStage, setMaxStage] = useState<Stage>(initialMaxStage);
  const [plan, setPlan] = useState<TreatmentPlan | null>(initialPlan);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stageIndex = STAGE_ORDER.indexOf(stage);
  const maxIndex = STAGE_ORDER.indexOf(maxStage);
  const steps = briefEnabled ? STEPS : STEPS.filter((s) => s.stage !== "brief");

  const goTo = useCallback(
    async (target: Stage) => {
      if (busy || target === stage) return;
      setBusy(true);
      setError(null);
      try {
        if (preview) {
          setStage(target);
          setMaxStage(
            STAGE_ORDER[Math.max(STAGE_ORDER.indexOf(target), STAGE_ORDER.indexOf(maxStage))],
          );
          return;
        }
        const res = await fetch("/api/stage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, to: target }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not change stage");
        setStage(data.stage as Stage);
        if (data.maxStage) setMaxStage(data.maxStage as Stage);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not change stage");
      } finally {
        setBusy(false);
      }
    },
    [token, stage, maxStage, busy, preview],
  );

  const advance = useCallback(
    () => goTo(STAGE_ORDER[Math.min(stageIndex + 1, STAGE_ORDER.length - 1)]),
    [goTo, stageIndex],
  );

  // An assessment with the briefing switched off starts at the first call; a
  // session created before the switch was flipped is moved along on load.
  useEffect(() => {
    if (!briefEnabled && stage === "brief") void goTo("call_1");
  }, [briefEnabled, stage, goTo]);

  const showSidebar = WITH_SIDEBAR.includes(stage) && (briefEnabled || stage === "call_2");
  const firstIndex = STAGE_ORDER.indexOf(steps[0].stage);
  const canGoBack = stageIndex > firstIndex && stage !== "done";

  const body = (
    <>
      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {stage === "brief" && briefEnabled && <Brief sections={brief} onFinished={advance} />}
      {stage === "brief" && !briefEnabled && (
        <p className="text-sm text-muted">Starting…</p>
      )}

      {stage === "call_1" && (
        <VoiceCall
          token={token}
          callNumber={1}
          patientName={patientName}
          onFinished={advance}
          preview={preview}
        />
      )}

      {stage === "chat" && (
        <Chat
          token={token}
          patientName={patientName}
          initial={initialChat}
          onFinished={advance}
          preview={preview}
          previewPhotos={previewPhotos}
        />
      )}

      {stage === "plan" && (
        <PlanForm
          token={token}
          patientName={patientName}
          doctor={doctor}
          onFinished={advance}
          onSaved={setPlan}
          preview={preview}
        />
      )}

      {stage === "call_2" && (
        <VoiceCall
          token={token}
          callNumber={2}
          patientName={patientName}
          onFinished={advance}
          preview={preview}
        />
      )}

      {(stage === "report" || stage === "done") && <Done token={token} preview={preview} />}
    </>
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium tracking-widest text-brand uppercase">Esvita Clinic</p>
          <p className="text-sm text-muted">{candidateName}</p>
        </div>

        <nav className="mt-4 flex gap-1.5">
          {steps.map((s) => {
            const i = STAGE_ORDER.indexOf(s.stage);
            const visited = maxIndex >= i;
            const active = stageIndex === i;
            return (
              <button
                key={s.stage}
                onClick={() => visited && void goTo(s.stage)}
                disabled={!visited || busy}
                title={visited ? `Go to ${s.label}` : "Not reached yet"}
                className={`flex-1 text-left ${visited ? "cursor-pointer" : "cursor-default"}`}
              >
                <div
                  className={`h-1 rounded-full ${
                    active ? "bg-brand" : visited ? "bg-brand/50" : "bg-line"
                  }`}
                />
                <p className={`mt-1.5 text-[11px] ${active ? "font-medium text-ink" : "text-muted"}`}>
                  {s.label}
                </p>
              </button>
            );
          })}
        </nav>

        {canGoBack && (
          <button
            onClick={() => void goTo(STAGE_ORDER[stageIndex - 1])}
            disabled={busy}
            className="mt-4 text-sm font-medium text-brand disabled:opacity-40"
          >
            ← Back to {steps.find((s) => s.stage === STAGE_ORDER[stageIndex - 1])?.label ?? "previous step"}
          </button>
        )}
      </header>

      {showSidebar ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div>{body}</div>
          {/* Remount when the deal panel appears, so call 2 opens on the deal
              rather than leaving the candidate on whichever tab they last used. */}
          <Sidebar
            key={stage === "call_2" ? "with-deal" : "clinic-only"}
            brief={brief}
            plan={plan}
            patientName={patientName}
            showDeal={stage === "call_2"}
            showClinic={briefEnabled}
          />
        </div>
      ) : (
        body
      )}
    </div>
  );
}
