import { errorResponse, HttpError } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import {
  BLOCK_ORDER,
  DEFAULT_BLOCKS,
  loadBlocks,
  resetBlock,
  saveBlock,
  type BlockKey,
} from "@/lib/prompt-blocks";

const isKey = (k: unknown): k is BlockKey =>
  typeof k === "string" && (BLOCK_ORDER as string[]).includes(k);

export async function GET(req: Request) {
  try {
    await requirePermission("editContent");
    const assessmentId = new URL(req.url).searchParams.get("assessment");
    if (!assessmentId) throw new HttpError(400, "An assessment is required");

    const bodies = await loadBlocks(assessmentId);
    return Response.json({
      blocks: BLOCK_ORDER.map((key) => ({
        key,
        label: DEFAULT_BLOCKS[key].label,
        help: DEFAULT_BLOCKS[key].help,
        placeholders: DEFAULT_BLOCKS[key].placeholders,
        body: bodies[key],
        isDefault: bodies[key].trim() === DEFAULT_BLOCKS[key].body.trim(),
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: Request) {
  try {
    await requirePermission("editContent");
    const { assessmentId, key, body } = (await req.json()) as {
      assessmentId?: string;
      key?: string;
      body?: string;
    };
    if (!assessmentId) throw new HttpError(400, "An assessment is required");
    if (!isKey(key)) throw new HttpError(400, "Unknown prompt block");
    if (typeof body !== "string" || !body.trim()) {
      throw new HttpError(400, "A prompt block cannot be empty");
    }

    await saveBlock(assessmentId, key, body);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Drops the override so the block falls back to the built-in default. */
export async function DELETE(req: Request) {
  try {
    await requirePermission("editContent");
    const { assessmentId, key } = (await req.json()) as { assessmentId?: string; key?: string };
    if (!assessmentId) throw new HttpError(400, "An assessment is required");
    if (!isKey(key)) throw new HttpError(400, "Unknown prompt block");

    await resetBlock(assessmentId, key);
    return Response.json({ ok: true, body: DEFAULT_BLOCKS[key].body });
  } catch (err) {
    return errorResponse(err);
  }
}
