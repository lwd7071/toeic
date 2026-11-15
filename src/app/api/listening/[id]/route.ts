import { ApiError, requireViewer } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { driveLink, ListeningItem, ListeningSet } from "@/lib/listening";
import { active } from "@/lib/models";
import { cachedListeningSet } from "@/lib/cached-content";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireViewer();
    const { id } = await context.params;
    const bundle = await cachedListeningSet(id);
    const set = bundle?.set as ListeningSet | undefined;
    if (!set || !active(set)) throw new ApiError(404, "Không tìm thấy bài listening.");
    const items = (bundle!.items as (ListeningItem & { id: string })[]).filter(active).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(i => ({ id: i.id, audioUrl: driveLink(i.audioUrl).previewUrl, audioViewUrl: i.audioUrl, ...(set.kind === "picture" ? { imageUrl: driveLink(i.imageUrl!).previewUrl, imageViewUrl: i.imageUrl } : {}) }));
    return Response.json({ set: { id, title: set.title, kind: set.kind }, items });
  } catch (error) { return jsonError(error); }
}
