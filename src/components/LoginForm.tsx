"use client";

import { useState } from "react";

/**
 * One screen, two ways in: the admin types their password, everyone else
 * requests a one-time code and types that into the same field.
 */
export default function LoginForm({ adminUser }: { adminUser: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);

  const isAdminUser = username.trim().toLowerCase() === adminUser.toLowerCase();

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sign-in failed");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setBusy(false);
    }
  }

  async function requestCode() {
    if (!username.trim()) {
      setError("Enter your username first");
      return;
    }
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send the code");

      setNotice(
        data.fallbackToLog
          ? "No email provider is configured — the code was written to the server log."
          : `Sign-in code sent to ${data.maskedEmail ?? "your email address"}. Valid for 10 minutes.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code");
    } finally {
      setSending(false);
    }
  }

  const input =
    "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="text-sm font-medium tracking-widest text-brand uppercase">Esvita Clinic</p>
      <h1 className="mt-1 text-2xl font-semibold">Assessment Center</h1>
      <p className="mt-2 text-sm text-muted">
        Administrators sign in with a password; everyone else uses a one-time code sent to their
        email.
      </p>

      <form onSubmit={login} className="mt-6 space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
            User
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="Username"
            className={input}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
            {isAdminUser || !username.trim() ? "Password" : "Sign-in code"}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isAdminUser ? "current-password" : "one-time-code"}
            placeholder={isAdminUser || !username.trim() ? "Password" : "6-digit code"}
            className={input}
          />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}
        {notice && (
          <p className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-muted">
            {notice}
          </p>
        )}

        <button
          disabled={busy || !username.trim() || !password.trim()}
          className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "Checking…" : "Sign in"}
        </button>

        {!isAdminUser && (
          <button
            type="button"
            onClick={() => void requestCode()}
            disabled={sending || !username.trim()}
            className="w-full rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {sending ? "Sending…" : "Email me a code"}
          </button>
        )}
      </form>
    </main>
  );
}
