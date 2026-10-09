import { loadBanks, loadObjections, resetBank, saveBank } from "@/lib/banks";
import { requirePermission } from "@/lib/permissions";
import { errorResponse, HttpError } from "@/lib/session";

export async function GET(req: Request) {
  try {
    await requirePermission("editContent");
    const assessmentId = new URL(req.url).searchParams.get("assessment");
    if (!assessmentId) throw new HttpError(400, "An assessment is required");

    const [banks, objections] = await Promise.all([
      loadBanks(assessmentId),
      loadObjections(assessmentId),
    ]);
    return Response.json({ banks, objections });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: Request) {
  try {
    await requirePermission("editContent");
    const { assessmentId, key, title, questions } = (await req.json()) as {
      assessmentId?: string;
      key?: string;
      title?: string;
      questions?: unknown;
    };
    if (!assessmentId || !key) throw new HttpError(400, "An assessment and a bank are required");
    if (!Array.isArray(questions) || questions.some((q) => typeof q !== "string")) {
      throw new HttpError(400, "Questions must be a list of lines");
    }

    await saveBank(assessmentId, key, (title ?? "").trim() || key, questions as string[]);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request) {
  try {
    await requirePermission("editContent");
    const { assessmentId, key } = (await req.json()) as { assessmentId?: string; key?: string };
    if (!assessmentId || !key) throw new HttpError(400, "An assessment and a bank are required");

    await resetBank(assessmentId, key);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
