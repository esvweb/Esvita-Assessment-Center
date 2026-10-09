import Link from "next/link";

export default function AssessmentTabs({
  assessmentId,
  assessmentName,
  active,
}: {
  assessmentId: string;
  assessmentName: string;
  active: "cases" | "brief" | "pricing" | "prompt" | "rubric";
}) {
  const tabs = [
    { key: "cases", label: "Cases", href: `/admin/assessments/${assessmentId}/cases` },
    { key: "brief", label: "Company info", href: `/admin/assessments/${assessmentId}/brief` },
    { key: "pricing", label: "Pricing", href: `/admin/assessments/${assessmentId}/pricing` },
    { key: "prompt", label: "Agent prompt", href: `/admin/assessments/${assessmentId}/prompt` },
    { key: "rubric", label: "Grading criteria", href: `/admin/assessments/${assessmentId}/rubric` },
  ] as const;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/assessments" className="text-sm font-medium text-brand">
          ← Assessments
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{assessmentName}</h1>
      </div>
      <nav className="flex gap-1 border-b border-line">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={`px-4 py-2.5 text-sm font-medium ${
              active === t.key
                ? "-mb-px border-b-2 border-brand text-brand"
                : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
