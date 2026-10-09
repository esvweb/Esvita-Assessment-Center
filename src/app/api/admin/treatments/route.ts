import { requirePermission } from "@/lib/permissions";
import { errorResponse, HttpError } from "@/lib/session";
import {
  createTreatment,
  deleteTreatment,
  listTreatments,
  updateTreatment,
} from "@/lib/treatments";

export async function GET(req: Request) {
  try {
    await requirePermission("editContent");
    const assessmentId = new URL(req.url).searchParams.get("assessment");
    if (!assessmentId) throw new HttpError(400, "An assessment is required");
    return Response.json({ treatments: await listTreatments(assessmentId, true) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    await requirePermission("editContent");
    const { assessmentId, ...input } = (await req.json()) as {
      assessmentId?: string;
      name?: string;
      minPrice?: number;
      currency?: string;
      unit?: string;
    };
    if (!assessmentId) throw new HttpError(400, "An assessment is required");
    if (!input.name?.trim()) throw new HttpError(400, "Give the treatment a name");
    if (input.minPrice != null && (!Number.isFinite(input.minPrice) || input.minPrice < 0)) {
      throw new HttpError(400, "The minimum price must be zero or more");
    }

    return Response.json({ treatment: await createTreatment(assessmentId, input) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    await requirePermission("editContent");
    const { id, ...input } = (await req.json()) as {
      id?: string;
      name?: string;
      minPrice?: number;
      currency?: string;
      unit?: string;
      isActive?: boolean;
    };
    if (!id) throw new HttpError(400, "A treatment id is required");
    if (input.minPrice != null && (!Number.isFinite(input.minPrice) || input.minPrice < 0)) {
      throw new HttpError(400, "The minimum price must be zero or more");
    }

    const treatment = await updateTreatment(id, input);
    if (!treatment) throw new HttpError(404, "That treatment no longer exists");
    return Response.json({ treatment });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request) {
  try {
    await requirePermission("destroy");
    const { id } = (await req.json()) as { id?: string };
    if (!id) throw new HttpError(400, "A treatment id is required");
    await deleteTreatment(id);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
