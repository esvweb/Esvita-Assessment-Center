import { isSignedIn } from "@/lib/auth";
import { createAssessment, listAssessments, updateAssessment } from "@/lib/assessments";
import { errorResponse, HttpError } from "@/lib/session";

async function requireLogin() {
  if (!(await isSignedIn())) throw new HttpError(401, "You need to sign in");
}

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
    const updated = await updateAssessment(id, rest as never);
    if (!updated) throw new HttpError(404, "Assessment not found");
    return Response.json({ assessment: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
