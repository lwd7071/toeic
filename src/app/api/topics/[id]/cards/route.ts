import { requireViewer, ApiError } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { active, Card } from "@/lib/models";
import { cachedCards } from "@/lib/cached-content";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireViewer();
    const { id } = await context.params;
    const store = db();
    const { topic, cards: content } = await cachedCards(id);
    if (!topic || !active(topic)) throw new ApiError(404, "Không tìm thấy chủ đề.");
    const progress = (await store.collection("topicProgress").doc(`${user.uid}_${id}`).get()).data()?.statuses ?? {};
    const cards = (content as (Card & { id: string })[]).filter(active).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(c => ({ id: c.id, english: c.english, vietnamese: c.vietnamese, status: progress[c.id] ?? "new" }));
    return Response.json({ topic, cards });
  } catch (error) { return jsonError(error); }
}
