"use client";

import { useState } from "react";
import type { BriefSection } from "@/lib/brief";
import type { TreatmentPlan } from "@/lib/types";

/**
 * Reference panel the candidate keeps beside them while they work: the clinic
 * facts during the first call and the chat, plus the deal they proposed once
 * they are on the closing call.
 */
export default function Sidebar({
  brief,
  plan,
  patientName,
  showDeal,
  showClinic,
}: {
  brief: BriefSection[];
  plan: TreatmentPlan | null;
  patientName: string;
  showDeal: boolean;
  showClinic: boolean;
}) {
  const [tab, setTab] = useState<"clinic" | "deal">(showDeal ? "deal" : "clinic");
  const [openSection, setOpenSection] = useState<string | null>(brief[0]?.id ?? null);

  // Nothing to keep beside the candidate: this assessment hides the clinic facts
  // and there is no deal to show yet.
  if (!showClinic && !showDeal) return null;

  return (
    <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:overflow-y-auto">
      <div className="rounded-xl border border-line bg-white">
        {showDeal && showClinic ? (
          <div className="flex border-b border-line">
            <button
              onClick={() => setTab("deal")}
              className={`flex-1 px-4 py-2.5 text-sm font-medium ${
                tab === "deal" ? "border-b-2 border-brand text-brand" : "text-muted"
              }`}
            >
              The deal
            </button>
            <button
              onClick={() => setTab("clinic")}
              className={`flex-1 px-4 py-2.5 text-sm font-medium ${
                tab === "clinic" ? "border-b-2 border-brand text-brand" : "text-muted"
              }`}
            >
              Clinic facts
            </button>
          </div>
        ) : (
          <div className="border-b border-line px-4 py-2.5">
            <p className="text-xs font-medium tracking-widest text-muted uppercase">
              {showDeal ? "The deal" : "Clinic facts"}
            </p>
          </div>
        )}

        {tab === "deal" && showDeal && (
          <div className="space-y-3 p-4 text-sm">
            {plan ? (
              <>
                <div>
                  <p className="text-xs tracking-wide text-muted uppercase">
                    What you sent {patientName}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{plan.summary}</p>
                </div>
                <ul className="space-y-1 border-t border-line pt-3">
                  {plan.items.map((i, k) => (
                    <li key={k}>
                      • {i.treatment} × {i.quantity}
                      {i.note ? ` — ${i.note}` : ""}
                    </li>
                  ))}
                </ul>
                <dl className="space-y-1.5 border-t border-line pt-3">
                  {[
                    ["Total", `${plan.total_price} ${plan.currency}`],
                    ["Trip", `${plan.trip_days} days · ${plan.visits} visit(s)`],
                    ["Guarantee", plan.guarantee],
                    ["Included", plan.included],
                    ["Next step", plan.next_step],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs tracking-wide text-muted uppercase">{k}</dt>
                      <dd>{v || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="text-muted">You haven&apos;t sent a treatment plan.</p>
            )}
          </div>
        )}

        {tab === "clinic" && showClinic && (
          <div className="divide-y divide-line">
            {brief.map((s) => (
              <div key={s.id}>
                <button
                  onClick={() => setOpenSection(openSection === s.id ? null : s.id)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium"
                >
                  {s.title}
                  <span className="text-muted">{openSection === s.id ? "−" : "+"}</span>
                </button>
                {openSection === s.id && (
                  <div className="px-4 pb-3 text-sm">
                    {s.body && <p className="leading-relaxed text-muted">{s.body}</p>}
                    {s.bullets.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {s.bullets.map((b) => (
                          <li key={b} className="flex gap-1.5">
                            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
            {brief.length === 0 && (
              <p className="px-4 py-3 text-sm text-muted">No clinic information configured.</p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
