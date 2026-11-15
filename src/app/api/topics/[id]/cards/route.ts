import { requireViewer, ApiError } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { active, Card, Topic } from "@/lib/models";
import { cachedCards } from "@/lib/cached-content";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireViewer();
    const { id } = await context.params;
    const store = db();
    const { topic, cards: content } = await cachedCards(id);
    if (!topic || !active(topic as Topic)) throw new ApiError(404, "Không tìm thấy chủ đề.");
    const progressSnap = await store.collection("cardProgress").where("uid", "==", user.uid).where("topicId", "==", id).get();
    const progress = new Map(progressSnap.docs.map(d => [d.data().cardId as string, d.data().status as string]));
    const cards = (content as (Card & { id: string })[]).filter(active).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(c => ({ id: c.id, english: c.english, vietnamese: c.vietnamese, status: progress.get(c.id) ?? "new" }));
    return Response.json({ topic, cards });
  } catch (error) { return jsonError(error); }
}
