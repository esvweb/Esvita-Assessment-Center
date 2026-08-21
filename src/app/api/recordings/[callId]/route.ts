import { isSignedIn } from "@/lib/auth";

/**
 * Streams a call recording through our own server.
 *
 * Vapi's recording storage is access-controlled: the raw storage URLs answer 400,
 * and the sanctioned path is an authenticated endpoint that 302s to a short-lived
 * signed URL. Proxying it here means the private key stays server-side, the
 * signed URL never reaches the browser, and — since these are recordings of real
 * people — only a signed-in reviewer can listen.
 *
 * Range requests are forwarded so the audio player can seek.
 */
export async function GET(req: Request, { params }: { params: Promise<{ callId: string }> }) {
  if (!(await isSignedIn())) return new Response("Unauthorized", { status: 401 });

  const { callId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(callId)) return new Response("Not found", { status: 404 });

  const key = process.env.VAPI_PRIVATE_KEY;
  if (!key) return new Response("VAPI_PRIVATE_KEY is not configured", { status: 500 });

  const range = req.headers.get("range");
  const upstream = await fetch(`https://api.vapi.ai/call/${callId}/mono-recording`, {
    headers: {
      Authorization: `Bearer ${key}`,
      ...(range ? { Range: range } : {}),
    },
  });

  if (!upstream.ok && upstream.status !== 206) {
    return new Response(`Recording unavailable (${upstream.status})`, { status: upstream.status });
  }

  const headers = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("content-type")) headers.set("content-type", "audio/wav");
  // Recordings are personal data; keep them out of shared caches.
  headers.set("Cache-Control", "private, max-age=3600");

  return new Response(upstream.body, { status: upstream.status, headers });
}
