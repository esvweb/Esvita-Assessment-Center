"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PatientCase } from "@/lib/cases";
import { objectionMap, type QuestionBank } from "@/lib/bank-types";
import type { TechnicalBank } from "@/lib/personas";
import { priceDoctorPlan, type CatalogueEntry } from "@/lib/upsell";

const input =
  "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand";
const label = "block text-xs font-medium tracking-wide text-muted uppercase mb-1.5";

const lines = (v: string[]) => v.join("\n");
const toLines = (v: string) =>
  v.split("\n").map((x) => x.trim()).filter(Boolean);

export default function CaseManager({
  assessmentId,
  initial,
  banks,
  objections,
  catalogue,
  canDestroy,
}: {
  assessmentId: string;
  initial: PatientCase[];
  /** The assessment's price list, for building the dentist's plan. */
  catalogue: CatalogueEntry[];
  /** Live banks, so the pickers follow whatever Agent prompt now says. */
  banks: QuestionBank[];
  objections: QuestionBank;
  canDestroy: boolean;
}) {
  const [cases, setCases] = useState(initial);
  const [openId, setOpenId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/admin/cases?assessmentId=${assessmentId}`);
    if (res.ok) setCases((await res.json()).cases);
  }

  async function addCase() {
    const res = await fetch("/api/admin/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assessmentId, name: "New case", pickupLine: "Hello?" }),
    });
    const d = await res.json();
    if (res.ok) {
      await refresh();
      setOpenId(d.case.id);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Cases</h2>
          <p className="mt-1 text-sm text-muted">
            The patients candidates face. Each case has its own prompt, voice and photos.
          </p>
        </div>
        <button
          onClick={() => void addCase()}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          + New case
        </button>
      </div>

      {notice && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {notice}
        </p>
      )}

      <div className="space-y-3">
        {cases.map((c) => (
          <CaseRow
            key={c.id}
            data={c}
            open={openId === c.id}
            onToggle={() => setOpenId(openId === c.id ? null : c.id)}
            onSaved={refresh}
            banks={banks}
            objections={objections}
            catalogue={catalogue}
            onNotice={setNotice}
            canDestroy={canDestroy}
          />
        ))}
        {cases.length === 0 && (
          <p className="rounded-xl border border-line bg-white px-5 py-8 text-center text-sm text-muted">
            No cases yet. Add one above.
          </p>
        )}
      </div>
    </div>
  );
}

function CaseRow({
  data,
  open,
  onToggle,
  onSaved,
  onNotice,
  banks,
  objections,
  catalogue,
  canDestroy,
}: {
  data: PatientCase;
  open: boolean;
  onToggle: () => void;
  onSaved: () => Promise<void>;
  onNotice: (m: string | null) => void;
  banks: QuestionBank[];
  objections: QuestionBank;
  catalogue: CatalogueEntry[];
  canDestroy: boolean;
}) {
  const objectionText = objectionMap(objections);
  const [form, setForm] = useState({
    name: data.name,
    age: data.age ?? "",
    country: data.country ?? "",
    headline: data.headline ?? "",
    pickupLine: data.pickupLine,
    situation: data.situation ?? "",
    personality: data.personality ?? "",
    casePlan: data.casePlan ?? "",
    hiddenSignals: lines(data.hiddenSignals),
    extraQuestions: lines(data.extraQuestions),
    objectionChain: data.objectionChain,
    technicalBanks: data.technicalBanks,
    specialRule: data.specialRule ?? "",
    extraPrompt: data.extraPrompt ?? "",
    doctorIndication: data.doctorIndication ?? "",
    doctorPlanValue: data.doctorPlanValue ?? "",
    doctorPlanItems: data.doctorPlanItems.map((i) => ({
      treatment: i.treatment,
      quantity: String(i.quantity),
    })),
    doctorPlanCurrency: data.doctorPlanCurrency ?? "EUR",
    voiceId: data.voice.voiceId,
    accent: data.voice.accent ?? "",
    isActive: data.isActive,
  });
  const [photos, setPhotos] = useState(data.photos);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/cases/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          age: form.age === "" ? null : Number(form.age),
          hiddenSignals: toLines(form.hiddenSignals),
          extraQuestions: toLines(form.extraQuestions),
          doctorIndication: form.doctorIndication || null,
          // With a price list the server prices the plan from its lines; the
          // hand-typed figure only stands in for an assessment that has none.
          doctorPlanItems: form.doctorPlanItems
            .filter((i) => i.treatment && Number(i.quantity) > 0)
            .map((i) => ({ treatment: i.treatment, quantity: Number(i.quantity) })),
          doctorPlanValue: catalogue.length
            ? null
            : form.doctorPlanValue === ""
              ? null
              : Number(form.doctorPlanValue),
          specialRule: form.specialRule || null,
          extraPrompt: form.extraPrompt || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not save");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete the case "${form.name}"?`)) return;
    const res = await fetch(`/api/admin/cases/${data.id}`, { method: "DELETE" });
    const d = await res.json();
    if (d.message) onNotice(d.message);
    await onSaved();
  }

  async function upload(file: File) {
    setError(null);
    const body = new FormData();
    body.append("file", file);
    body.append("caption", "");
    const res = await fetch(`/api/admin/cases/${data.id}/photos`, { method: "POST", body });
    const d = await res.json();
    if (!res.ok) return setError(d.error ?? "Could not upload the photo");
    setPhotos((p) => [...p, d.photo]);
  }

  async function removePhoto(photoId: string) {
    await fetch(`/api/admin/cases/${data.id}/photos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId }),
    });
    setPhotos((p) => p.filter((x) => x.id !== photoId));
  }

  return (
    <section className="rounded-xl border border-line bg-white">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span>
          <span className="font-medium">
            #{data.id} {form.name}
          </span>
          {!form.isActive && (
            <span className="ml-2 rounded bg-surface px-1.5 py-0.5 text-xs text-muted">inactive</span>
          )}
          <span className="ml-2 text-sm text-muted">{form.headline}</span>
        </span>
        <span className="text-sm text-muted">
          {photos.length} photos · {open ? "close" : "edit"}
        </span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-line px-5 py-5">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className={label}>Name</label>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>Age</label>
              <input value={form.age} onChange={(e) => set("age", e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>Country</label>
              <input value={form.country} onChange={(e) => set("country", e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>Status</label>
              <select
                value={form.isActive ? "1" : "0"}
                onChange={(e) => set("isActive", e.target.value === "1")}
                className={input}
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className={label}>Short description (shown in the panel)</label>
            <input value={form.headline} onChange={(e) => set("headline", e.target.value)} className={input} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={label}>What they say on answering</label>
              <input
                value={form.pickupLine}
                onChange={(e) => set("pickupLine", e.target.value)}
                className={input}
              />
              <p className="mt-1 text-xs text-muted">
                The call is outbound — the patient only answers; the candidate opens the
                conversation.
              </p>
            </div>
            <div>
              <label className={label}>Voice (Vapi voiceId)</label>
              <input value={form.voiceId} onChange={(e) => set("voiceId", e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>Accent description</label>
              <input value={form.accent} onChange={(e) => set("accent", e.target.value)} className={input} />
            </div>
          </div>

          <div>
            <label className={label}>Situation</label>
            <textarea rows={3} value={form.situation} onChange={(e) => set("situation", e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Personality</label>
            <textarea rows={3} value={form.personality} onChange={(e) => set("personality", e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Treatment plan the clinic prepared</label>
            <textarea rows={2} value={form.casePlan} onChange={(e) => set("casePlan", e.target.value)} className={input} />
          </div>

          <div className="rounded-lg border border-line p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <span className={`${label} mb-0`}>Dentist&apos;s indication</span>
              <span className="text-xs text-muted">
                Shown to the candidate while they write their plan; the report&apos;s upsell
                analysis compares against it
              </span>
            </div>
            <textarea
              rows={6}
              value={form.doctorIndication}
              onChange={(e) => set("doctorIndication", e.target.value)}
              placeholder="What is clinically indicated after reviewing the photos and x-ray…"
              className={input}
            />
            {catalogue.length > 0 ? (
              <DoctorPlanEditor
                catalogue={catalogue}
                items={form.doctorPlanItems}
                onChange={(items) => set("doctorPlanItems", items)}
              />
            ) : (
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <label className={label}>Value of the doctor&apos;s plan</label>
                <input
                  value={form.doctorPlanValue}
                  onChange={(e) => set("doctorPlanValue", e.target.value)}
                  placeholder="7190"
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Currency</label>
                <select
                  value={form.doctorPlanCurrency}
                  onChange={(e) => set("doctorPlanCurrency", e.target.value)}
                  className={input}
                >
                  <option>EUR</option>
                  <option>GBP</option>
                  <option>USD</option>
                </select>
              </div>
            </div>
            )}
          </div>

          <div>
            <label className={label}>Hidden signals — one per line</label>
            <textarea
              rows={4}
              value={form.hiddenSignals}
              onChange={(e) => set("hiddenSignals", e.target.value)}
              className={input}
            />
            <p className="mt-1 text-xs text-muted">
              The patient drops each of these once, in passing. The report measures whether the
              candidate picked them up.
            </p>
          </div>

          <div>
            <label className={label}>Objection chain — delivered in this order</label>
            <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 rounded-lg border border-line p-3">
              {Object.entries(objectionText).map(([key, text]) => {
                const idx = form.objectionChain.indexOf(key);
                return (
                  <label key={key} className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={idx !== -1}
                      onChange={(e) =>
                        set(
                          "objectionChain",
                          e.target.checked
                            ? [...form.objectionChain, key]
                            : form.objectionChain.filter((k) => k !== key),
                        )
                      }
                      className="mt-0.5 h-3.5 w-3.5 accent-[var(--color-brand)]"
                    />
                    <span>
                      {idx !== -1 && <span className="font-medium text-brand">{idx + 1}. </span>}
                      <span title={text}>{key}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className={label}>Technical question banks</label>
            <div className="flex gap-4">
              {banks.map(({ key: b, title }) => (
                <label key={b} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.technicalBanks.includes(b as TechnicalBank)}
                    onChange={(e) =>
                      set(
                        "technicalBanks",
                        e.target.checked
                          ? [...form.technicalBanks, b as TechnicalBank]
                          : form.technicalBanks.filter((x) => x !== b),
                      )
                    }
                    className="h-3.5 w-3.5 accent-[var(--color-brand)]"
                  />
                  {b} — {title}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className={label}>Case-specific questions — one per line</label>
            <textarea rows={2} value={form.extraQuestions} onChange={(e) => set("extraQuestions", e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Special rule</label>
            <textarea rows={2} value={form.specialRule} onChange={(e) => set("specialRule", e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Extra prompt — appended verbatim</label>
            <textarea rows={3} value={form.extraPrompt} onChange={(e) => set("extraPrompt", e.target.value)} className={input} />
          </div>

          <div>
            <label className={label}>Patient photos</label>
            <div className="grid grid-cols-4 gap-3">
              {photos.map((p) => (
                <div key={p.id} className="rounded-lg border border-line p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption} className="h-24 w-full rounded object-cover" />
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-xs text-muted">{Math.round(p.sizeBytes / 1024)} KB</span>
                    <button onClick={() => void removePhoto(p.id)} className="text-xs text-red-700">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => fileRef.current?.click()}
                className="flex h-[7.5rem] items-center justify-center rounded-lg border border-dashed border-line text-sm text-muted hover:border-brand hover:text-brand"
              >
                + Add photo
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <FullPrompt caseId={data.id} />

          {error && <p className="text-sm text-red-700">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              onClick={() => void save()}
              disabled={saving}
              className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {saved && <span className="text-sm text-brand">Saved</span>}
            {canDestroy && (
              <button
                type="button"
                onClick={() => void remove()}
                className="ml-auto text-sm font-medium text-red-700"
              >
                Delete case
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * The literal text this case's agent is given, assembled by the same builder
 * the live session uses. It is here so that tuning a case never means guessing
 * what the model actually sees — if the patient behaves oddly, the cause is on
 * this screen.
 */
function FullPrompt({ caseId }: { caseId: number }) {
  const [stage, setStage] = useState<"call_1" | "chat" | "call_2">("call_1");
  const [prompt, setPrompt] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(
    async (next: typeof stage) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/prompt/preview?case=${caseId}&stage=${next}`);
        const d = await res.json();
        setPrompt(res.ok ? d.prompt : (d.error ?? "Could not build the prompt"));
      } finally {
        setLoading(false);
      }
    },
    [caseId],
  );

  useEffect(() => {
    if (open) void load(stage);
  }, [open, stage, load]);

  const STAGES = [
    ["call_1", "Call 1"],
    ["chat", "Messaging"],
    ["call_2", "Call 2"],
  ] as const;

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold">Full agent prompt</h4>
          <p className="mt-0.5 text-sm text-muted">
            Exactly what the patient is told for this case. Shared wording is edited under Agent
            prompt; everything else comes from the fields above.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium"
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>

      {open && (
        <>
          <div className="mt-3 flex items-center gap-1">
            {STAGES.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStage(key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  stage === key ? "bg-brand text-white" : "border border-line bg-white text-muted"
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              disabled={!prompt}
              onClick={() => {
                if (!prompt) return;
                void navigator.clipboard.writeText(prompt);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="ml-auto text-sm font-medium text-brand disabled:opacity-40"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="mt-2 max-h-[28rem] overflow-auto rounded-lg border border-line bg-white p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {loading ? "Building…" : prompt}
          </pre>
        </>
      )}
    </div>
  );
}

/**
 * The dentist's plan as lines from the price list. The total shown here is
 * only a preview — the server prices the plan again on save, from the list,
 * because it is the baseline every candidate's upsell is measured against.
 */
function DoctorPlanEditor({
  catalogue,
  items,
  onChange,
}: {
  catalogue: CatalogueEntry[];
  items: { treatment: string; quantity: string }[];
  onChange: (items: { treatment: string; quantity: string }[]) => void;
}) {
  const priced = priceDoctorPlan(
    items.map((i) => ({ treatment: i.treatment, quantity: Number(i.quantity) || 0 })),
    catalogue,
  );
  const names = new Set(catalogue.map((t) => t.name));
  const fieldCls =
    "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand";
  const fmt = (n: number) => n.toLocaleString("en-GB", { maximumFractionDigits: 2 });

  const patch = (i: number, p: Partial<{ treatment: string; quantity: string }>) =>
    onChange(items.map((it, j) => (i === j ? { ...it, ...p } : it)));

  return (
    <div className="mt-3">
      <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
        Dentist&apos;s plan, priced from the price list
      </p>
      <div className="space-y-2">
        {items.map((it, i) => {
          const line = priced.lines[i];
          const unknown = it.treatment !== "" && !names.has(it.treatment);
          return (
            <div key={i} className="grid grid-cols-12 items-center gap-2">
              <select
                value={unknown ? "" : it.treatment}
                onChange={(e) => patch(i, { treatment: e.target.value })}
                className={`col-span-7 ${fieldCls} ${unknown ? "border-red-500" : ""}`}
              >
                <option value="">{unknown ? `Not in the price list: ${it.treatment}` : "Choose…"}</option>
                {catalogue.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} — {fmt(t.minPrice)} {t.currency} / {t.unit}
                  </option>
                ))}
              </select>
              <input
                value={it.quantity}
                onChange={(e) => patch(i, { quantity: e.target.value })}
                inputMode="numeric"
                placeholder="Qty"
                className={`col-span-2 ${fieldCls}`}
              />
              <span className="col-span-2 text-right text-sm">
                {line?.known ? `${fmt(line.total)} ${priced.currency}` : "—"}
              </span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                aria-label="Remove this line"
                className="col-span-1 text-sm text-muted hover:text-red-700"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
        <button
          type="button"
          onClick={() => onChange([...items, { treatment: "", quantity: "1" }])}
          className="text-sm font-medium text-brand"
        >
          + Add a line
        </button>
        <p className="text-sm">
          <span className="text-muted">Plan value</span>{" "}
          <span className="font-semibold">
            {fmt(priced.total)} {priced.currency}
          </span>
        </p>
      </div>
    </div>
  );
}
