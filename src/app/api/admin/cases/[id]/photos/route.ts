import { requirePermission } from "@/lib/permissions";
import { addPhoto, deletePhoto } from "@/lib/cases";
import { errorResponse, HttpError } from "@/lib/session";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

const requireLogin = () => requirePermission("editContent");

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireLogin();
    const caseId = Number((await params).id);
    if (!Number.isInteger(caseId)) throw new HttpError(400, "Invalid case id");

    const form = await req.formData();
    const file = form.get("file");
    const caption = String(form.get("caption") ?? "");

    if (!(file instanceof File)) throw new HttpError(400, "A file is required");
    if (!ALLOWED.includes(file.type)) {
      throw new HttpError(400, `Unsupported file type: ${file.type || "unknown"}`);
    }
    if (file.size > MAX_BYTES) throw new HttpError(413, "File exceeds the 8 MB limit");

    const bytes = Buffer.from(await file.arrayBuffer());
    return Response.json({ photo: await addPhoto(caseId, caption, file.type, bytes) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request) {
  try {
    await requireLogin();
    const { photoId } = (await req.json()) as { photoId?: string };
    if (!photoId) throw new HttpError(400, "photoId is required");
    await deletePhoto(photoId);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
