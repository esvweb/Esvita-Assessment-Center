import type { UpsellAnalysis, UpsellTag } from "@/lib/upsell";

const money = (n: number, c: string) =>
  `${n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("en-GB", { maximumFractionDigits: 2 })} ${c}`;

const signed = (n: number, c: string) => (n > 0 ? `+${money(n, c)}` : money(n, c));

const TAG_STYLE: Record<UpsellTag, string> = {
  "as indicated": "bg-surface text-muted",
  "higher-priced alternative": "bg-emerald-50 text-emerald-800",
  "priced above list": "bg-emerald-50 text-emerald-800",
  "more units": "bg-amber-50 text-amber-800",
  "added beyond indication": "bg-red-50 text-red-700",
  "lower-priced alternative": "bg-amber-50 text-amber-800",
  "fewer units": "bg-amber-50 text-amber-800",
  "missing from plan": "bg-red-50 text-red-700",
};

/**
 * The same figures the grader is given, laid out for a person. Colour marks
 * direction only — whether an added line is overselling or a comfort item the
 * patient asked for is the report's call, not this table's.
 */
export default function UpsellView({ analysis }: { analysis: UpsellAnalysis }) {
  const c = analysis.currency;
  const drivers = [
    ["Priced above list", analysis.markup],
    ["Higher/lower-priced alternatives", analysis.alternative],
    ["Added beyond the indication", analysis.added],
    ["Indicated treatment left out", -analysis.missing],
  ] as const;

  return (
    <section className="rounded-xl border border-line bg-white p-6">
      <h2 className="text-base font-semibold">Upsell analysis</h2>
      <p className="mt-1 text-sm text-muted">
        The candidate&apos;s plan against the dentist&apos;s, both priced from this
        assessment&apos;s price list. Compared by treatment group, so a better implant brand
        counts as an upgrade rather than as a dropped line and an added one.
      </p>

      <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div>
          <dt className="text-xs tracking-wide text-muted uppercase">Dentist&apos;s plan</dt>
          <dd className="mt-0.5 text-lg font-semibold">{money(analysis.doctorTotal, c)}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-muted uppercase">Candidate quoted</dt>
          <dd className="mt-0.5 text-lg font-semibold">{money(analysis.candidateTotal, c)}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-muted uppercase">Difference</dt>
          <dd className="mt-0.5 text-lg font-semibold">
            {signed(analysis.delta, c)}
            {analysis.deltaPercent != null && (
              <span className="ml-1 text-sm font-normal text-muted">
                ({analysis.deltaPercent > 0 ? "+" : ""}
                {analysis.deltaPercent}%)
              </span>
            )}
          </dd>
        </div>
      </dl>

      <ul className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
        {drivers.map(([label, value]) => (
          <li key={label} className="flex justify-between">
            <span className="text-muted">{label}</span>
            <span className={value === 0 ? "text-muted" : "font-medium"}>{signed(value, c)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs tracking-wide text-muted uppercase">
            <tr className="border-b border-line">
              <th className="py-2 pr-3 font-medium">Group</th>
              <th className="py-2 pr-3 font-medium">Dentist</th>
              <th className="py-2 pr-3 font-medium">Candidate</th>
              <th className="py-2 font-medium">Reading</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line align-top">
            {analysis.rows.map((r) => (
              <tr key={r.group}>
                <td className="py-2 pr-3 font-medium">{r.group}</td>
                <td className="py-2 pr-3">
                  {r.doctorQuantity ? (
                    <>
                      {r.doctorQuantity} × {r.doctorItems.join(" / ")}
                      <div className="text-xs text-muted">{money(r.doctorValue, c)}</div>
                    </>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  {r.candidateQuantity ? (
                    <>
                      {r.candidateQuantity} × {r.candidateItems.join(" / ")}
                      <div className="text-xs text-muted">
                        {money(r.candidateQuotedValue, c)}
                        {r.markup !== 0 && ` (list ${money(r.candidateListValue, c)})`}
                      </div>
                    </>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-1">
                    {r.tags.map((t) => (
                      <span key={t} className={`rounded px-1.5 py-0.5 text-xs ${TAG_STYLE[t]}`}>
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {analysis.unpriced.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          Not in the price list, so counted at face value or zero: {analysis.unpriced.join("; ")}
        </p>
      )}
    </section>
  );
}
