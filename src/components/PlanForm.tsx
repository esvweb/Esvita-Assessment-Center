"use client";

import { useState } from "react";
import type { TreatmentPlan } from "@/lib/types";

export interface DoctorIndication {
  text: string | null;
  value: number | null;
  currency: string;
}

interface Props {
  token: string;
  patientName: string;
  doctor?: DoctorIndication;
  onFinished: () => void;
  onSaved?: (plan: TreatmentPlan) => void;
  preview?: boolean;
}

const EMPTY_ITEM = { treatment: "", quantity: "", note: "" };

export default function PlanForm({
  token,
  patientName,
  doctor,
  onFinished,
  onSaved,
  preview = false,
}: Props) {
  const [plan, setPlan] = useState<TreatmentPlan>({
    summary: "",
    items: [{ ...EMPTY_ITEM }],
    total_price: "",
    currency: "EUR",
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

  function setItem(i: number, key: "treatment" | "quantity" | "note", value: string) {
    setPlan((p) => ({
      ...p,
      items: p.items.map((it, j) => (i === j ? { ...it, [key]: value } : it)),
    }));
  }

  async function submit() {
    setError(null);
    const items = plan.items.filter((i) => i.treatment.trim() && i.quantity.trim());
    if (!plan.summary.trim() || items.length === 0) {
      setError("Write a summary and at least one treatment line before sending.");
      return;
    }
    if (preview) {
      onSaved?.({ ...plan, items });
      onFinished();
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, plan: { ...plan, items } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send the plan");
      onSaved?.({ ...plan, items });
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
          half understand it, and ask you about it. Prices and package terms are in the panel beside
          you.
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
          <div className="space-y-2">
            {plan.items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <input
                  value={item.treatment}
                  onChange={(e) => setItem(i, "treatment", e.target.value)}
                  placeholder="e.g. Zirconia crown"
                  className={`col-span-5 ${input}`}
                />
                <input
                  value={item.quantity}
                  onChange={(e) => setItem(i, "quantity", e.target.value)}
                  placeholder="Qty"
                  className={`col-span-2 ${input}`}
                />
                <input
                  value={item.note ?? ""}
                  onChange={(e) => setItem(i, "note", e.target.value)}
                  placeholder="Note (optional)"
                  className={`col-span-5 ${input}`}
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => setPlan((p) => ({ ...p, items: [...p.items, { ...EMPTY_ITEM }] }))}
            className="mt-2 text-sm font-medium text-brand"
          >
            + Add a line
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Total price</label>
            <input
              value={plan.total_price}
              onChange={(e) => setField("total_price", e.target.value)}
              placeholder="4200"
              className={input}
            />
          </div>
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
          disabled={saving}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-40"
        >
          {saving ? "Sending…" : `Send the plan to ${patientName}`}
        </button>
      </div>
    </div>
  );
}
