/**
 * A small, safe Markdown renderer for text the panel writes and candidates read.
 *
 * Everything is HTML-escaped first and only a fixed set of tags is produced
 * afterwards, so nothing typed into the editor can inject markup — the
 * briefing is written by moderators and shown to candidates. It covers what a
 * briefing needs (headings, paragraphs, bold, italic, bullet and numbered
 * lists) and nothing more.
 */

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s: string): string {
  return escape(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(\S(?:.*?\S)?)\*/g, "<em>$1</em>");
}

export interface MarkdownStyle {
  p: string;
  h2: string;
  h3: string;
  ul: string;
  ol: string;
  li: string;
}

export const BRIEF_STYLE: MarkdownStyle = {
  p: "text-sm leading-relaxed text-muted",
  h2: "pt-2 text-sm font-semibold text-ink",
  h3: "pt-1 text-sm font-semibold text-ink",
  ul: "list-disc space-y-1 pl-5 text-sm marker:text-brand",
  ol: "list-decimal space-y-1 pl-5 text-sm marker:text-brand",
  li: "leading-relaxed",
};

export function renderMarkdown(source: string, style: MarkdownStyle = BRIEF_STYLE): string {
  const out: string[] = [];
  let paragraph: string[] = [];
  let list: { kind: "ul" | "ol"; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p class="${style.p}">${paragraph.map(inline).join("<br>")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map((i) => `<li class="${style.li}">${inline(i)}</li>`).join("");
      out.push(`<${list.kind} class="${style[list.kind]}">${items}</${list.kind}>`);
    }
    list = null;
  };

  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.+)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.+)$/.exec(line);

    if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      // h4/h5 rather than h2/h3: the page around a section already owns those.
      const [tag, cls] = heading[1].length <= 2 ? ["h4", style.h2] : ["h5", style.h3];
      out.push(`<${tag} class="${cls}">${inline(heading[2])}</${tag}>`);
    } else if (bullet || numbered) {
      flushParagraph();
      const kind = bullet ? "ul" : "ol";
      if (list && list.kind !== kind) flushList();
      if (!list) list = { kind, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return out.join("");
}

/** Plain text for the models: headings and lists kept, formatting marks dropped. */
export function markdownToText(source: string): string {
  return source
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(\S(?:.*?\S)?)\*/g, "$1")
    .trim();
}

/**
 * A briefing section as one Markdown text. Sections written before the editor
 * kept a separate bullet list; folding it in here means an old section reads
 * the same everywhere and turns into plain editable text the first time it is
 * opened.
 */
export function sectionMarkdown(section: { body: string; bullets?: string[] }): string {
  const bullets = (section.bullets ?? []).map((b) => `- ${b}`).join("\n");
  return [section.body.trim(), bullets].filter(Boolean).join("\n\n");
}
