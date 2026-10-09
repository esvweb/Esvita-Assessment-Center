"use client";

import { useMemo, useState } from "react";
import type { Treatment } from "@/lib/treatments";
import type { TreatmentPlan, TreatmentPlanItem } from "@/lib/types";

export interface DoctorIndication {
  text: string | null;
  value: number | null;
  currency: string;
}

interface Props {
  token: string;
  patientName: string;
  treatments: Treatment[];
  doctor?: DoctorIndication;
  onFinished: () => void;
  onSaved?: (plan: TreatmentPlan) => void;
  preview?: boolean;
}

const EMPTY_ITEM: TreatmentPlanItem = {
  treatment: "",
  quantity: "1",
  unit_price: "",
  min_price: "",
};

const num = (v: string | undefined) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const money = (n: number, currency: string) =>
  `${n.toLocaleString("en-GB", { maximumFractionDigits: 2 })} ${currency}`;

export default function PlanForm({
  token,
  patientName,
  treatments,
  doctor,
  onFinished,
  onSaved,
  preview = false,
}: Props) {
  const [plan, setPlan] = useState<TreatmentPlan>({
    summary: "",
    items: [{ ...EMPTY_ITEM }],
    total_price: "",
    currency: treatments[0]?.currency ?? "EUR",
    trip_days: "",
    visits: "1",
    guarantee: "",
    included: "",
    next_step: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof TreatmentPlan>(key: K, value: TreatmentPlan[K]) {
    setPlan((p) => ({ ...p, [key]: value }));
  }

  function patchItem(i: number, patch: Partial<TreatmentPlanItem>) {
    setPlan((p) => ({
      ...p,
      items: p.items.map((it, j) => (i === j ? { ...it, ...patch } : it)),
    }));
  }

  /** Picking a treatment seeds the line with the catalogue floor as its price. */
  function chooseTreatment(i: number, name: string) {
    const t = treatments.find((x) => x.name === name);
    patchItem(i, {
      treatment: name,
      unit_price: t ? String(t.minPrice) : "",
      min_price: t ? String(t.minPrice) : "",
    });
  }

  const lines = plan.items.map((it) => ({
    item: it,
    total: num(it.quantity) * num(it.unit_price),
    belowFloor: it.min_price !== "" && num(it.unit_price) < num(it.min_price),
  }));

  const grandTotal = useMemo(
    () => lines.reduce((sum, l) => sum + (l.item.treatment ? l.total : 0), 0),
    [lines],
  );

  const anyBelowFloor = lines.some((l) => l.item.treatment && l.belowFloor);

  async function submit() {
    setError(null);
    const items = plan.items.filter((i) => i.treatment.trim() && num(i.quantity) > 0);

    if (!plan.summary.trim() || items.length === 0) {
      setError("Write a summary and add at least one treatment before sending.");
      return;
    }
    if (anyBelowFloor) {
      setError("One of your lines is priced below the minimum. Raise it before sending.");
      return;
    }

    const finished: TreatmentPlan = { ...plan, items, total_price: String(grandTotal) };

    if (preview) {
      onSaved?.(finished);
      onFinished();
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, plan: finished }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send the plan");
      onSaved?.(finished);
      onFinished();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the plan");
      setSaving(false);
    }
  }

  const input =
    "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand";
  const label = "block text-xs font-medium tracking-wide text-muted uppercase mb-1.5";

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-line bg-white p-6">
        <p className="text-xs font-medium tracking-widest text-muted uppercase">
          Stage 3 — Treatment plan
        </p>
        <h2 className="mt-1 text-xl font-semibold">Prepare the plan for {patientName}</h2>
        <p className="mt-2 text-sm text-muted">
          This is what {patientName} receives in writing before your second call. They will read it,
          half understand it, and ask you about it.
        </p>
      </div>

      {doctor?.text && (
        <div className="rounded-xl border border-line bg-white p-6">
          <div className="flex items-baseline justify-between">
            <h3 className="text-base font-semibold">The dentist&apos;s indication</h3>
            {doctor.value != null && (
              <span className="text-sm text-muted">
                Plan value:{" "}
                <span className="font-medium text-ink">
                  {doctor.value.toLocaleString("en-GB")} {doctor.currency}
                </span>
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            Our treating dentist reviewed {patientName}&apos;s photos and x-ray. This is what is
            clinically indicated — build your plan on top of it.
          </p>
          <pre className="mt-3 rounded-lg border border-line bg-surface p-4 text-sm whitespace-pre-wrap">
            {doctor.text}
          </pre>
          <p className="mt-3 text-xs text-muted">
            You may propose more than the minimum where the patient genuinely benefits, and you
            should say so if you do. You may not propose treatment the dentist has not indicated, or
            promise a date the indication rules out.
          </p>
        </div>
      )}

      <div className="space-y-5 rounded-xl border border-line bg-white p-6">
        <div>
          <label className={label}>Summary for the patient</label>
          <textarea
            rows={4}
            value={plan.summary}
            onChange={(e) => setField("summary", e.target.value)}
            placeholder="Explain in plain language what you are proposing and why."
            className={input}
          />
        </div>

        <div>
          <label className={label}>Treatments</label>

          {treatments.length === 0 ? (
            <p className="rounded-lg border border-line bg-surface p-3 text-sm text-muted">
              No priced treatments have been set up for this assessment yet. Ask an administrator to
              add them under Assessments → Pricing.
            </p>
          ) : (
            <>
              <div className="hidden grid-cols-12 gap-2 px-1 pb-1 text-xs tracking-wide text-muted uppercase sm:grid">
                <span className="col-span-5">Treatment</span>
                <span className="col-span-2">Qty</span>
                <span className="col-span-2">Price each</span>
                <span className="col-span-2 text-right">Line total</span>
              </div>

              <div className="space-y-2">
                {lines.map(({ item, total, belowFloor }, i) => (
                  <div key={i}>
                    <div className="grid grid-cols-12 items-center gap-2">
                      <select
                        value={item.treatment}
                        onChange={(e) => chooseTreatment(i, e.target.value)}
                        className={`col-span-5 ${input}`}
                      >
                        <option value="">Choose a treatment…</option>
                        {treatments.map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.name} — from {money(t.minPrice, t.currency)} / {t.unit}
                          </option>
                        ))}
                      </select>

                      <input
                        value={item.quantity}
                        onChange={(e) => patchItem(i, { quantity: e.target.value })}
                        inputMode="numeric"
                        placeholder="Qty"
                        className={`col-span-2 ${input}`}
                      />

                      <input
                        value={item.unit_price ?? ""}
                        onChange={(e) => patchItem(i, { unit_price: e.target.value })}
                        inputMode="decimal"
                        disabled={!item.treatment}
                        placeholder="—"
                        className={`col-span-2 ${input} ${
                          belowFloor ? "border-red-500 text-red-700" : ""
                        } disabled:bg-surface`}
                      />

                      <span className="col-span-2 text-right text-sm font-medium">
                        {item.treatment ? money(total, plan.currency) : "—"}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setPlan((p) => ({
                            ...p,
                            items:
                              p.items.length === 1
                                ? [{ ...EMPTY_ITEM }]
                                : p.items.filter((_, j) => j !== i),
                          }))
                        }
                        aria-label="Remove this line"
                        className="col-span-1 text-sm text-muted hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>

                    {item.treatment && (
                      <p
                        className={`mt-1 pl-1 text-xs ${belowFloor ? "text-red-700" : "text-muted"}`}
                      >
                        {belowFloor
                          ? `Below the minimum of ${money(num(item.min_price), plan.currency)} — raise the price to continue.`
                          : `Minimum ${money(num(item.min_price), plan.currency)}. You may quote above it.`}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => setPlan((p) => ({ ...p, items: [...p.items, { ...EMPTY_ITEM }] }))}
                  className="text-sm font-medium text-brand"
                >
                  + Add a line
                </button>
                <p className="text-sm">
                  <span className="text-muted">Total</span>{" "}
                  <span className="text-base font-semibold">
                    {money(grandTotal, plan.currency)}
                  </span>
                </p>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Currency</label>
            <select
              value={plan.currency}
              onChange={(e) => setField("currency", e.target.value)}
              className={input}
            >
              <option>EUR</option>
              <option>GBP</option>
              <option>USD</option>
            </select>
          </div>
          <div>
            <label className={label}>Days in Istanbul</label>
            <input
              value={plan.trip_days}
              onChange={(e) => setField("trip_days", e.target.value)}
              placeholder="7"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Number of visits</label>
            <input
              value={plan.visits}
              onChange={(e) => setField("visits", e.target.value)}
              placeholder="2"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Guarantee</label>
            <input
              value={plan.guarantee}
              onChange={(e) => setField("guarantee", e.target.value)}
              placeholder="What exactly is guaranteed, and for how long?"
              className={input}
            />
          </div>
        </div>

        <div>
          <label className={label}>What the package includes</label>
          <textarea
            rows={2}
            value={plan.included}
            onChange={(e) => setField("included", e.target.value)}
            className={input}
          />
        </div>
        <div>
          <label className={label}>Next step you are proposing</label>
          <input
            value={plan.next_step}
            onChange={(e) => setField("next_step", e.target.value)}
            placeholder="e.g. video call with the surgeon on Thursday, then €250 reservation"
            className={input}
          />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <button
          onClick={() => void submit()}
          disabled={saving || anyBelowFloor}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-40"
        >
          {saving ? "Sending…" : `Send the plan to ${patientName}`}
        </button>
      </div>
    </div>
  );
}
