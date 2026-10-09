"use client";

import { useEffect, useRef, useState } from "react";

interface Msg {
  speaker: "candidate" | "patient";
  text: string;
  attachments?: string[];
  captions?: string[];
}

interface Props {
  token: string;
  patientName: string;
  initial: Msg[];
  onFinished: () => void;
  preview?: boolean;
  previewPhotos?: { url: string; caption: string }[];
}

const PHOTO_WORDS = /photo|picture|pic|image|x-?ray|xray|scan|send me/i;

export default function Chat({
  token,
  patientName,
  initial,
  onFinished,
  preview = false,
  previewPhotos = [],
}: Props) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gotPhotos, setGotPhotos] = useState(initial.some((m) => m.attachments?.length));
  // Patients send x-rays and intraoral shots; a 96px thumbnail is not something
  // a candidate can actually read a case from.
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setError(null);
    setMessages((m) => [...m, { speaker: "candidate", text }]);
    setSending(true);

    // Preview mode fakes the patient locally so every screen — including the
    // photo bubbles — can be reviewed without an Anthropic key.
    if (preview) {
      const asksForPhotos = PHOTO_WORDS.test(text);
      setTimeout(() => {
        setMessages((m) => [
          ...m,
          asksForPhotos
            ? {
                speaker: "patient",
                text: "ok here you go, hope these are alright",
                attachments: previewPhotos.map((p) => p.url),
                captions: previewPhotos.map((p) => p.caption),
              }
            : {
                speaker: "patient",
                text: "(preview mode — a real patient reply needs OPENAI_API_KEY. Try \"can you send me some photos?\" to see the photo flow.)",
              },
        ]);
        if (asksForPhotos) setGotPhotos(true);
        setSending(false);
      }, 500);
      return;
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send the message");

      setMessages((m) => [
        ...m,
        {
          speaker: "patient",
          text: data.reply,
          attachments: data.attachments,
          captions: (data.photos ?? []).map((p: { caption: string }) => p.caption),
        },
      ]);
      if (data.attachments?.length) setGotPhotos(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div>
            <p className="text-sm font-semibold">{patientName}</p>
            <p className="text-xs text-muted">WhatsApp · online</p>
          </div>
          <p className="text-xs text-muted">Messaging stage</p>
        </div>

        <div className="max-h-[26rem] space-y-3 overflow-y-auto bg-surface px-5 py-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.speaker === "candidate" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                  m.speaker === "candidate"
                    ? "rounded-br-sm bg-brand text-white"
                    : "rounded-bl-sm border border-line bg-white"
                }`}
              >
                {m.text}
                {!!m.attachments?.length && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {m.attachments.map((src, j) => (
                      <button
                        key={src}
                        type="button"
                        onClick={() =>
                          setLightbox({ src, alt: m.captions?.[j] ?? "Patient photo" })
                        }
                        className="group relative block cursor-zoom-in"
                        aria-label="Open this photo full size"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={m.captions?.[j] ?? "Patient photo"}
                          className="h-24 w-full rounded-lg border border-line bg-white object-cover transition group-hover:brightness-90"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {sending && <p className="text-xs text-muted italic">{patientName} is typing…</p>}
          <div ref={endRef} />
        </div>

        <div className="flex gap-2 border-t border-line px-4 py-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Write a message…"
            className="flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <button
            onClick={() => void send()}
            disabled={sending || !draft.trim()}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex items-center justify-between rounded-xl border border-line bg-white px-5 py-4">
        <p className="text-sm text-muted">
          {gotPhotos
            ? "You have the patient's photos. Move on when you are ready to prepare the treatment plan."
            : "Get what you need from the patient here. You will need their photos before you can build a plan."}
        </p>
        <button
          onClick={onFinished}
          className="ml-4 shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Prepare the plan →
        </button>
      </div>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.alt}
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex cursor-zoom-out flex-col items-center justify-center bg-black/80 p-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.src}
            alt={lightbox.alt}
            className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
          />
          <p className="mt-3 text-sm text-white/80">{lightbox.alt}</p>
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-5 text-3xl leading-none text-white/70 hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
