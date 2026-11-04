import { ApiError, requireViewer } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { driveLink, ListeningItem, ListeningSet } from "@/lib/listening";
import { active } from "@/lib/models";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireViewer();
    const { id } = await context.params, store = db();
    const set = (await store.collection("listeningSets").doc(id).get()).data() as ListeningSet | undefined;
    if (!set || !active(set)) throw new ApiError(404, "Không tìm thấy bài listening.");
    const snap = await store.collection("listeningItems").where("setId", "==", id).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() as ListeningItem })).filter(active).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(i => ({ id: i.id, audioUrl: driveLink(i.audioUrl).previewUrl, audioViewUrl: i.audioUrl, ...(set.kind === "picture" ? { imageUrl: driveLink(i.imageUrl!).previewUrl, imageViewUrl: i.imageUrl } : {}) }));
    return Response.json({ set: { id, title: set.title, kind: set.kind }, items });
  } catch (error) { return jsonError(error); }
}
