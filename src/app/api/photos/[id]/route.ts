import { getPhotoBytes } from "@/lib/cases";

/**
 * Serves a case photo. Deliberately unauthenticated: the patient sends these to
 * the candidate mid-assessment, and the ids are unguessable UUIDs. They are
 * clinical stock/placeholder images, not records tied to a real person.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  const photo = await getPhotoBytes(id);
  if (!photo) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      "Content-Type": photo.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
