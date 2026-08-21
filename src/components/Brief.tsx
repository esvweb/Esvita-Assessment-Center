"use client";

import { useState } from "react";
import type { BriefSection } from "@/lib/brief";

export default function Brief({
  sections,
  onFinished,
}: {
  sections: BriefSection[];
  onFinished: () => void;
}) {
  const [read, setRead] = useState(false);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-line bg-white p-6">
        <p className="text-xs font-medium tracking-widest text-brand uppercase">Stage 1 — Briefing</p>
        <h2 className="mt-1 text-xl font-semibold">Everything you need to know about Esvita Clinic</h2>
        <p className="mt-2 text-sm text-muted">
          You are about to speak with a real prospective patient — as one of our medical advisors.
          You will not be able to look anything up mid-call, so read this properly now. You may keep
          this page open in a second tab during the assessment.
        </p>
      </div>

      <div className="space-y-4">
        {sections.map((section) => (
          <section key={section.id} className="rounded-xl border border-line bg-white p-6">
            <h3 className="text-base font-semibold">{section.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{section.body}</p>
            {section.bullets.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {section.bullets.map((b) => (
                  <li key={b} className="flex gap-2 text-sm">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <p className="mb-4 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">
          You will be calling the patient — they are not expecting your call and will not recognise
          your number. Opening the conversation is on you. These clinic facts stay available in a
          panel beside you for the rest of the assessment.
        </p>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={read}
            onChange={(e) => setRead(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]"
          />
          <span>
            I have read the briefing and I am ready to take a live call. I understand the call is
            recorded and transcribed for assessment.
          </span>
        </label>
        <button
          onClick={onFinished}
          disabled={!read}
          className="mt-4 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-40"
        >
          I&apos;m ready — take the call
        </button>
      </div>
    </div>
  );
}
