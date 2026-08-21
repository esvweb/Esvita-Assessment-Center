import { notFound, redirect } from "next/navigation";
import AssessmentTabs from "@/components/AssessmentTabs";
import RubricManager from "@/components/RubricManager";
import { getAssessment } from "@/lib/assessments";
import { isSignedIn } from "@/lib/auth";
import { listRubricVersions } from "@/lib/rubric";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isSignedIn())) redirect("/?as=staff");
  const { id } = await params;
  const assessment = await getAssessment(id);
  if (!assessment) notFound();

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <AssessmentTabs assessmentId={id} assessmentName={assessment.name} active="rubric" />
      <RubricManager assessmentId={id} initial={await listRubricVersions(id)} />
    </main>
  );
}
