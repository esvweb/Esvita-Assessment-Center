import { notFound, redirect } from "next/navigation";
import AssessmentTabs from "@/components/AssessmentTabs";
import PromptManager from "@/components/PromptManager";
import { getAssessment } from "@/lib/assessments";
import { isSignedIn } from "@/lib/auth";
import { loadBanks, loadObjections } from "@/lib/banks";
import { BLOCK_ORDER, DEFAULT_BLOCKS, loadBlocks } from "@/lib/prompt-blocks";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isSignedIn())) redirect("/?as=staff");
  const { id } = await params;
  const assessment = await getAssessment(id);
  if (!assessment) notFound();

  const [bodies, banks, objections] = await Promise.all([
    loadBlocks(id),
    loadBanks(id),
    loadObjections(id),
  ]);

  const blocks = BLOCK_ORDER.map((key) => ({
    key,
    label: DEFAULT_BLOCKS[key].label,
    help: DEFAULT_BLOCKS[key].help,
    placeholders: DEFAULT_BLOCKS[key].placeholders,
    body: bodies[key],
    isDefault: bodies[key].trim() === DEFAULT_BLOCKS[key].body.trim(),
  }));

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <AssessmentTabs assessmentId={id} assessmentName={assessment.name} active="prompt" />
      <PromptManager
        assessmentId={id}
        initialBlocks={blocks}
        initialBanks={banks}
        initialObjections={objections}
      />
    </main>
  );
}
