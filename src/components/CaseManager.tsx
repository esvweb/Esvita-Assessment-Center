"use client";

import { useRef, useState } from "react";
import type { PatientCase } from "@/lib/cases";
import { OBJECTION_BANK, TECHNICAL_BANKS, type TechnicalBank } from "@/lib/personas";

const input =
  "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand";
const label = "block text-xs font-medium tracking-wide text-muted uppercase mb-1.5";

const lines = (v: string[]) => v.join("\n");
const toLines = (v: string) =>
  v.split("\n").map((x) => x.trim()).filter(Boolean);

export default function CaseManager({
  assessmentId,
  initial,
}: {
  assessmentId: string;
  initial: PatientCase[];
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
            onNotice={setNotice}
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
}: {
  data: PatientCase;
  open: boolean;
  onToggle: () => void;
  onSaved: () => Promise<void>;
  onNotice: (m: string | null) => void;
}) {
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
          doctorPlanValue: form.doctorPlanValue === "" ? null : Number(form.doctorPlanValue),
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
              {Object.entries(OBJECTION_BANK).map(([key, text]) => {
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
              {(Object.keys(TECHNICAL_BANKS) as TechnicalBank[]).map((b) => (
                <label key={b} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.technicalBanks.includes(b)}
                    onChange={(e) =>
                      set(
                        "technicalBanks",
                        e.target.checked
                          ? [...form.technicalBanks, b]
                          : form.technicalBanks.filter((x) => x !== b),
                      )
                    }
                    className="h-3.5 w-3.5 accent-[var(--color-brand)]"
                  />
                  {b} — {TECHNICAL_BANKS[b].title}
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
            <button onClick={() => void remove()} className="ml-auto text-sm font-medium text-red-700">
              Delete case
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
