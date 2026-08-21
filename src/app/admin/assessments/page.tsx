import { redirect } from "next/navigation";
import AssessmentList from "@/components/AssessmentList";
import { listAssessments } from "@/lib/assessments";
import { myPermissions } from "@/lib/permissions";
import { isSignedIn } from "@/lib/auth";
import { isDatabaseReady } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function AssessmentsPage() {
  if (!(await isSignedIn())) redirect("/?as=staff");
  if (!isDatabaseReady()) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-muted">Connect the database first.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <AssessmentList
        initial={await listAssessments()}
        canDestroy={(await myPermissions())?.destroy ?? false}
      />
    </main>
  );
}
