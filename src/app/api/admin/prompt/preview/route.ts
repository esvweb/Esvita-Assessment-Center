import { loadBanks, loadObjections } from "@/lib/banks";
import { listBrief } from "@/lib/brief";
import { getCase } from "@/lib/cases";
import { requirePermission } from "@/lib/permissions";
import { buildPatientPrompt } from "@/lib/prompt";
import { loadBlocks } from "@/lib/prompt-blocks";
import { errorResponse, HttpError } from "@/lib/session";
import type { Stage } from "@/lib/types";

const STAGES: Stage[] = ["call_1", "chat", "call_2"];

/**
 * The exact text the model is given for one case at one stage.
 *
 * This runs the same builder the live session runs, with a sample plan standing
 * in for whatever the candidate will send — so what the panel shows is what the
 * patient is actually told, not a summary of it.
 */
export async function GET(req: Request) {
  try {
    await requirePermission("editContent");
    const params = new URL(req.url).searchParams;
    const caseId = Number(params.get("case"));
    const stage = (params.get("stage") ?? "call_1") as Stage;

    if (!Number.isInteger(caseId)) throw new HttpError(400, "A case is required");
    if (!STAGES.includes(stage)) throw new HttpError(400, "Pick call 1, messaging or call 2");

    const patient = await getCase(caseId);
    if (!patient) throw new HttpError(404, "That case no longer exists");

    const [brief, blocks, banks, objections] = await Promise.all([
      listBrief(patient.assessmentId),
      loadBlocks(patient.assessmentId),
      loadBanks(patient.assessmentId),
      loadObjections(patient.assessmentId),
    ]);

    const prompt = buildPatientPrompt({
      patient,
      brief,
      blocks,
      banks,
      objections,
      stage,
      history: [],
      candidateName: "the candidate",
      plan:
        stage === "call_2"
          ? {
              summary: "(the plan the candidate writes appears here)",
              items: [{ treatment: "(their treatment lines)", quantity: "1", unit_price: "0" }],
              total_price: "0",
              currency: "EUR",
              trip_days: "7",
              visits: "1",
              guarantee: "(their guarantee)",
              included: "(what they said is included)",
              next_step: "(the next step they proposed)",
            }
          : null,
    });

    return Response.json({ prompt, stage });
  } catch (err) {
    return errorResponse(err);
  }
}
