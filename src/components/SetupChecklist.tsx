import Link from "next/link";
import type { ServiceStatus } from "@/lib/config";

export default function SetupChecklist({ services }: { services: ServiceStatus[] }) {
  return (
    <div className="rounded-xl border border-line bg-white p-6">
      <h2 className="text-base font-semibold">Setup status</h2>
      <p className="mt-1 text-sm text-muted">
        A database is required before any candidate session can be created. The rest are needed
        when their stage runs.
      </p>
      <ul className="mt-4 space-y-2.5">
        {services.map((s) => (
          <li key={s.key} className="flex items-start gap-3 text-sm">
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                s.ready ? "bg-brand" : "bg-amber-400"
              }`}
            />
            <span>
              <span className="font-medium">{s.label}</span>{" "}
              <span className={s.ready ? "text-brand" : "text-muted"}>
                {s.ready ? "connected" : "waiting"}
              </span>
              {!s.ready && (
                <span className="block text-xs text-muted">
                  <code>.env.local</code> → {s.hint}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-muted">
        In the meantime you can walk the interface in{" "}
        <Link href="/preview" className="font-medium text-brand">
          preview mode
        </Link>{" "}
        — every screen a candidate sees, with nothing connected.
      </p>
    </div>
  );
}
