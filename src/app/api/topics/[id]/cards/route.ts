import { requireViewer, ApiError } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { active, Card, Topic } from "@/lib/models";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireViewer();
    const { id } = await context.params;
    const store = db();
    const topicDoc = await store.collection("vocabTopics").doc(id).get();
    if (!topicDoc.exists || !active(topicDoc.data() as Topic)) throw new ApiError(404, "Không tìm thấy chủ đề.");
    const [cardsSnap, progressSnap] = await Promise.all([
      store.collection("vocabCards").where("topicId", "==", id).get(),
      store.collection("cardProgress").where("uid", "==", user.uid).get(),
    ]);
    const progress = new Map(progressSnap.docs.map(d => [d.data().cardId as string, d.data().status as string]));
    const cards = cardsSnap.docs.map(d => ({ id: d.id, ...d.data() as Card })).filter(active).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(c => ({ id: c.id, english: c.english, vietnamese: c.vietnamese, status: progress.get(c.id) ?? "new" }));
    return Response.json({ topic: { id, ...(topicDoc.data() as Topic) }, cards });
  } catch (error) { return jsonError(error); }
}
