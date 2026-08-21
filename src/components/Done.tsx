"use client";

import { useEffect, useState } from "react";

export default function Done({ token, preview = false }: { token: string; preview?: boolean }) {
  const [state, setState] = useState<"working" | "done" | "error">(preview ? "done" : "working");

  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!cancelled) setState(res.ok ? "done" : "error");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, preview]);

  return (
    <div className="rounded-xl border border-line bg-white p-8 text-center">
      <h2 className="text-xl font-semibold">That&apos;s the end of the assessment</h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted">
        Thank you for taking the time. The HR team will review the full session and follow up with
        you. You can close this tab.
      </p>
      <p className="mt-6 text-xs text-muted">
        {state === "working" && "Wrapping up your session…"}
        {state === "done" && "Session submitted."}
        {state === "error" &&
          "Your session was recorded. The summary step will be completed by the team."}
      </p>
    </div>
  );
}
