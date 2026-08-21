import { requirePermission } from "@/lib/permissions";
import { createCase, listCases } from "@/lib/cases";
import { errorResponse, HttpError } from "@/lib/session";

const requireLogin = () => requirePermission("editContent");

export async function GET(req: Request) {
  try {
    await requireLogin();
    const assessmentId = new URL(req.url).searchParams.get("assessmentId");
    if (!assessmentId) throw new HttpError(400, "assessmentId is required");
    return Response.json({ cases: await listCases(assessmentId, true) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireLogin();
    const body = await req.json();
    if (!body?.assessmentId) throw new HttpError(400, "assessmentId is required");
    if (!body?.name?.trim()) throw new HttpError(400, "A case name is required");
    return Response.json({ case: await createCase(body.assessmentId, body) });
  } catch (err) {
    return errorResponse(err);
  }
}
