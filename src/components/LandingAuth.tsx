"use client";

import { useState } from "react";

type View = "choice" | "candidate" | "staff";

/**
 * The single front door. Candidates and staff need different credentials, so the
 * first thing the page asks is which one you are — rather than showing one
 * ambiguous form and hoping people pick the right fields.
 */
export default function LandingAuth({ initialView = "choice" }: { initialView?: View }) {
  const [view, setView] = useState<View>(initialView);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16">
      <Backdrop />

      <div className="relative w-full max-w-md">
        <header className="mb-8 text-center">
          <Mark />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Esvita Assessment Center</h1>
          <p className="mt-2 text-sm text-muted">
            Roleplay-based assessment for medical advisor candidates
          </p>
        </header>

        <div className="rounded-2xl border border-line bg-white p-7 shadow-[0_1px_2px_rgba(15,23,32,.04),0_12px_32px_-12px_rgba(15,23,32,.12)]">
          {view === "choice" && <Choice onPick={setView} />}
          {view === "candidate" && <CandidateForm onBack={() => setView("choice")} />}
          {view === "staff" && <StaffForm onBack={() => setView("choice")} />}
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Esvita Clinic · Istanbul
        </p>
      </div>
    </main>
  );
}

/** Soft brand wash so the card sits on something, not on a blank page. */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-gradient-to-b from-white via-surface to-surface" />
      <div className="absolute -top-40 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-brand/[.07] blur-3xl" />
      <div className="absolute -bottom-56 -right-32 h-[28rem] w-[28rem] rounded-full bg-brand/[.05] blur-3xl" />
    </div>
  );
}

function Mark() {
  return (
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white shadow-[0_6px_16px_-6px_rgba(13,122,111,.7)]">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3.5c-2.2 0-3.4 1.1-3.4 3.2 0 1.4.5 3.1.5 4.6 0 2.3-1.2 3.4-1.2 6.1 0 1.9.8 3.1 2 3.1 1.5 0 1.6-2.4 2.1-4.3.3-1.1.6-1.7 1-1.7s.7.6 1 1.7c.5 1.9.6 4.3 2.1 4.3 1.2 0 2-1.2 2-3.1 0-2.7-1.2-3.8-1.2-6.1 0-1.5.5-3.2.5-4.6 0-2.1-1.2-3.2-3.4-3.2-.6 0-1.1.3-2 .3s-1.4-.3-2-.3Z" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function Choice({ onPick }: { onPick: (v: View) => void }) {
  return (
    <div className="space-y-3">
      <p className="mb-4 text-center text-sm font-medium">How would you like to sign in?</p>

      <button
        onClick={() => onPick("candidate")}
        className="group flex w-full items-center gap-4 rounded-xl border border-line px-4 py-4 text-left transition hover:border-brand hover:bg-brand/[.03]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
            <path d="M4.5 20a7.5 7.5 0 0 1 15 0" strokeLinecap="round" />
          </svg>
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">I&apos;m a candidate</span>
          <span className="block text-sm text-muted">
            Enter the 6-character code you were sent
          </span>
        </span>
        <Chevron />
      </button>

      <button
        onClick={() => onPick("staff")}
        className="group flex w-full items-center gap-4 rounded-xl border border-line px-4 py-4 text-left transition hover:border-brand hover:bg-brand/[.03]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 20V9l8-5 8 5v11" strokeLinejoin="round" />
            <path d="M9.5 20v-5h5v5" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">Staff sign-in</span>
          <span className="block text-sm text-muted">We&apos;ll email you a one-time code</span>
        </span>
        <Chevron />
      </button>
    </div>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="ml-auto h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const field =
  "w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10";
const labelCls = "mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase";

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    // Without an explicit type this defaults to submit, and being the first such
    // button in the form it would swallow the Enter key.
    <button type="button" onClick={onBack} className="mb-5 text-sm font-medium text-brand">
      ← Back
    </button>
  );
}

function Submit({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }) {
  return (
    <button
      disabled={busy}
      className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-40"
    >
      {busy ? busyLabel : label}
    </button>
  );
}

function CandidateForm({ onBack }: { onBack: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/candidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Sign-in failed");
      window.location.href = `/a/${d.token}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <BackLink onBack={onBack} />
      <h2 className="text-base font-semibold">Candidate sign-in</h2>
      <p className="mt-1 mb-5 text-sm text-muted">
        Enter the six-character code from your invitation. Set aside about 45 uninterrupted minutes,
        and use headphones if you can — part of this is a live call.
      </p>

      <div>
        <label className={labelCls}>Assessment code</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
          placeholder="00000A"
          autoComplete="off"
          spellCheck={false}
          autoFocus
          maxLength={6}
          className={`${field} text-center font-mono text-2xl tracking-[.5em]`}
        />
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      <div className="mt-5">
        <Submit busy={busy} label="Start my assessment" busyLabel="Checking…" />
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        Lost your code? Reply to the email you received.
      </p>
    </form>
  );
}

function StaffForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [denied, setDenied] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await res.json();
      if (res.status === 403 && d.error === "unauthorised") {
        setDenied(email.trim());
        return;
      }
      if (!res.ok) throw new Error(d.error ?? "Could not send the code");
      setSent(true);
      setNotice(
        d.fallbackToLog
          ? "No email provider is configured — the code was written to the server log."
          : `Code sent to ${d.maskedEmail ?? "your address"}. It is valid for 10 minutes.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code");
    } finally {
      setBusy(false);
    }
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(showPassword ? { username, password } : { email, code }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Sign-in failed");
      window.location.href = "/admin";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setBusy(false);
    }
  }

  if (denied) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-700">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5" strokeLinecap="round" />
            <circle cx="12" cy="16.2" r=".9" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <h2 className="mt-4 text-base font-semibold">Not authorised</h2>
        <p className="mt-2 text-sm text-muted">
          <span className="font-medium text-ink">{denied}</span> is not registered for panel access,
          so no code was sent.
        </p>
        <p className="mt-3 text-sm text-muted">
          If you should have access, ask an administrator to add you. If you are a candidate, use
          your assessment code instead.
        </p>
        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={() => {
              setDenied(null);
              setEmail("");
            }}
            className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Try another address
          </button>
          <button
            type="button"
            onClick={onBack}
            className="w-full rounded-lg border border-line px-4 py-2.5 text-sm font-medium"
          >
            Back to sign-in options
          </button>
        </div>
      </div>
    );
  }

  if (showPassword) {
    return (
      <form onSubmit={signIn}>
        <BackLink onBack={() => setShowPassword(false)} />
        <h2 className="text-base font-semibold">Password sign-in</h2>
        <p className="mt-1 mb-5 text-sm text-muted">
          For the administrator account, when email is unavailable.
        </p>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} className={field} />
          </div>
          <div>
            <label className={labelCls}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
            />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <div className="mt-5">
          <Submit busy={busy} label="Sign in" busyLabel="Checking…" />
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={sent ? signIn : requestCode}>
      <BackLink onBack={onBack} />
      <h2 className="text-base font-semibold">Staff sign-in</h2>
      <p className="mt-1 mb-5 text-sm text-muted">
        Enter your work address and we&apos;ll send you a one-time code.
      </p>

      <div className="space-y-3">
        <div>
          <label className={labelCls}>Work email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@esvitaclinic.com"
            autoComplete="email"
            disabled={sent}
            className={`${field} disabled:bg-surface disabled:text-muted`}
          />
        </div>

        {sent && (
          <div>
            <label className={labelCls}>Code from your email</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              className={`${field} font-mono text-lg tracking-[.4em]`}
            />
          </div>
        )}
      </div>

      {notice && (
        <p className="mt-3 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-muted">
          {notice}
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      <div className="mt-5">
        <Submit
          busy={busy}
          label={sent ? "Sign in" : "Email me a code"}
          busyLabel={sent ? "Checking…" : "Sending…"}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        {sent ? (
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setCode("");
              setNotice(null);
            }}
            className="font-medium text-brand"
          >
            Use a different address
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => setShowPassword(true)}
          className="text-muted hover:text-ink"
        >
          Admin password instead
        </button>
      </div>
    </form>
  );
}
