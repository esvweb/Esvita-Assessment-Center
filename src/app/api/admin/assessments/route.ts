import { requirePermission } from "@/lib/permissions";
import { createAssessment, listAssessments, updateAssessment } from "@/lib/assessments";
import { errorResponse, HttpError } from "@/lib/session";

const requireLogin = () => requirePermission("editContent");

export async function GET() {
  try {
    await requireLogin();
    return Response.json({ assessments: await listAssessments() });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireLogin();
    const { name, description } = (await req.json()) as {
      name?: string;
      description?: string;
    };
    if (!name?.trim()) throw new HttpError(400, "An assessment name is required");
    return Response.json({ assessment: await createAssessment({ name: name.trim(), description }) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    await requireLogin();
    const { id, ...rest } = (await req.json()) as { id?: string; [k: string]: unknown };
    if (!id) throw new HttpError(400, "id is required");
    // Retiring an assessment takes it away from everyone, so it needs delete rights.
    if (rest.isActive === false) await requirePermission("destroy");
    const updated = await updateAssessment(id, rest as never);
    if (!updated) throw new HttpError(404, "Assessment not found");
    return Response.json({ assessment: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
