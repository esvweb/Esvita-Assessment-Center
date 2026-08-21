"use client";

import { useState } from "react";
import { DEFAULT_CRITERIA, DEFAULT_INSTRUCTIONS, type Criterion, type RubricVersion } from "@/lib/rubric";

const input =
  "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand";
const label = "block text-xs font-medium tracking-wide text-muted uppercase mb-1.5";

/**
 * Saving never overwrites. Each save appends a version that becomes active, and
 * every earlier edition stays below, readable forever — reports are graded
 * against whichever version was live at the time, so old scores must remain
 * explainable.
 */
export default function RubricManager({
  assessmentId,
  initial,
}: {
  assessmentId: string;
  initial: RubricVersion[];
}) {
  const [versions, setVersions] = useState(initial);
  const active = versions[0] ?? null;

  const [criteria, setCriteria] = useState<Criterion[]>(active?.criteria ?? DEFAULT_CRITERIA);
  const [instructions, setInstructions] = useState(active?.instructions ?? DEFAULT_INSTRUCTIONS);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openVersion, setOpenVersion] = useState<string | null>(null);

  function setCriterion(i: number, patch: Partial<Criterion>) {
    setCriteria((c) => c.map((x, j) => (i === j ? { ...x, ...patch } : x)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/rubric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId, criteria, instructions, note }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not save");
      setNote("");
      const list = await fetch(`/api/admin/rubric?assessmentId=${assessmentId}`);
      if (list.ok) setVersions((await list.json()).versions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  function loadVersion(v: RubricVersion) {
    setCriteria(v.criteria);
    setInstructions(v.instructions);
    setNote(`Restored from v${v.version}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          Grading criteria{" "}
          {active ? (
            <span className="ml-1 rounded bg-surface px-2 py-0.5 text-sm text-brand">
              v{active.version} active
            </span>
          ) : (
            <span className="ml-1 rounded bg-surface px-2 py-0.5 text-sm text-muted">
              not saved yet — showing defaults
            </span>
          )}
        </h2>
        <p className="mt-1 text-sm text-muted">
          The model that writes the report scores against these criteria and instructions. Saving
          never overwrites: the new version becomes active on top, and earlier ones stay below.
        </p>
      </div>

      <section className="space-y-5 rounded-xl border border-line bg-white p-6">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className={label}>Criteria — each scored 1–5</span>
            <button
              onClick={() =>
                setCriteria((c) => [...c, { key: `criterion_${c.length + 1}`, label: "", description: "" }])
              }
              className="text-sm font-medium text-brand"
            >
              + Add criterion
            </button>
          </div>

          <div className="space-y-3">
            {criteria.map((c, i) => (
              <div key={i} className="rounded-lg border border-line p-3">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-3">
                    <input
                      value={c.key}
                      onChange={(e) => setCriterion(i, { key: e.target.value })}
                      placeholder="key"
                      className={`${input} font-mono text-xs`}
                    />
                  </div>
                  <div className="col-span-7">
                    <input
                      value={c.label}
                      onChange={(e) => setCriterion(i, { label: e.target.value })}
                      placeholder="Label"
                      className={input}
                    />
                  </div>
                  <button
                    onClick={() => setCriteria((x) => x.filter((_, j) => j !== i))}
                    className="col-span-2 rounded-lg border border-line text-sm text-red-700"
                  >
                    Remove
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={c.description}
                  onChange={(e) => setCriterion(i, { description: e.target.value })}
                  placeholder="How should the model score this criterion?"
                  className={`${input} mt-2`}
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            Keys become the score field names in the report: lowercase, digits and underscores.
          </p>
        </div>

        <div>
          <label className={label}>Scoring instructions and report template</label>
          <textarea
            rows={14}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className={`${input} font-mono text-xs`}
          />
          <p className="mt-1 text-xs text-muted">
            The legal disclaimer is fixed in code and appended to every report — you do not need to
            add it here.
          </p>
        </div>

        <div>
          <label className={label}>Note for this version (optional)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. increased weight on technical knowledge"
            className={input}
          />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <button
          onClick={() => void save()}
          disabled={saving || criteria.length === 0}
          className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {saving ? "Saving…" : `Save as new version${active ? ` (v${active.version + 1})` : " (v1)"}`}
        </button>
      </section>

      {versions.length > 0 && (
        <section>
          <h3 className="mb-3 text-base font-semibold">Version history</h3>
          <div className="space-y-2">
            {versions.map((v, i) => (
              <div key={v.id} className="rounded-xl border border-line bg-white">
                <button
                  onClick={() => setOpenVersion(openVersion === v.id ? null : v.id)}
                  className="flex w-full items-center justify-between px-5 py-3 text-left"
                >
                  <span className="text-sm">
                    <span className="font-medium">v{v.version}</span>
                    {i === 0 && <span className="ml-2 text-xs text-brand">active</span>}
                    <span className="ml-3 text-muted">
                      {new Date(v.createdAt).toLocaleString("en-GB")}
                      {v.createdBy && ` · ${v.createdBy}`}
                    </span>
                    {v.note && <span className="ml-3 text-muted">— {v.note}</span>}
                  </span>
                  <span className="text-sm text-muted">
                    {v.criteria.length} criteria · {openVersion === v.id ? "close" : "show"}
                  </span>
                </button>

                {openVersion === v.id && (
                  <div className="space-y-3 border-t border-line px-5 py-4 text-sm">
                    <ul className="space-y-1">
                      {v.criteria.map((c) => (
                        <li key={c.key}>
                          <span className="font-medium">{c.label}</span>{" "}
                          <span className="font-mono text-xs text-muted">({c.key})</span>
                        </li>
                      ))}
                    </ul>
                    <pre className="max-h-64 overflow-auto rounded-lg bg-surface p-3 font-mono text-xs whitespace-pre-wrap">
                      {v.instructions}
                    </pre>
                    {i !== 0 && (
                      <button onClick={() => loadVersion(v)} className="text-sm font-medium text-brand">
                        Load this version into the editor
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
