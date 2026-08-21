"use client";

import { useState } from "react";


interface AssessmentOption {
  id: string;
  name: string;
  cases: { id: number; name: string; headline: string }[];
}

export default function InviteForm({ assessments }: { assessments: AssessmentOption[] }) {
  const [assessmentId, setAssessmentId] = useState(assessments[0]?.id ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileId, setProfileId] = useState<string>("auto");
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setLink(null);
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_name: name,
          candidate_email: email,
          assessment_id: assessmentId,
          profile_id: profileId === "auto" ? "auto" : Number(profileId),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create the invitation");
      setLink(data.link);
      setName("");
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the invitation");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand";

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-line bg-white p-6">
      <h2 className="text-base font-semibold">Invite a candidate</h2>
      <div className="grid grid-cols-4 gap-3">
        <select
          value={assessmentId}
          onChange={(e) => {
            setAssessmentId(e.target.value);
            setProfileId("auto");
          }}
          className={input}
        >
          {assessments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Candidate name"
          className={input}
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional)"
          className={input}
        />
        <select
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
          className={input}
        >
          <option value="auto">Case: rotate automatically</option>
          {(assessments.find((a) => a.id === assessmentId)?.cases ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              #{c.id} {c.name} — {c.headline}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {link && (
        <div className="rounded-lg border border-line bg-surface px-3 py-2">
          <p className="text-xs text-muted">Send this link to the candidate:</p>
          <code className="text-sm break-all">{link}</code>
        </div>
      )}
      <button
        disabled={busy || !name.trim()}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        {busy ? "Creating…" : "Create invitation"}
      </button>
    </form>
  );
}
