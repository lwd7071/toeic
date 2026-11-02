import { requireViewer, ApiError } from "@/lib/auth";
import { jsonError, requireCsrf } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { active, Card, Topic, now } from "@/lib/models";

export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireCsrf();
    const user = await requireViewer();
    const { id } = await context.params;
    const { status } = await request.json();
    if (status !== "remembered" && status !== "review") throw new ApiError(400, "Trạng thái thẻ không hợp lệ.");
    const store = db();
    const cardDoc = await store.collection("vocabCards").doc(id).get();
    const card = cardDoc.data() as Card | undefined;
    if (!card || !active(card)) throw new ApiError(404, "Không tìm thấy thẻ.");
    const topicDoc = await store.collection("vocabTopics").doc(card.topicId).get();
    if (!topicDoc.exists || !active(topicDoc.data() as Topic)) throw new ApiError(404, "Chủ đề đã bị ẩn.");
    await store.collection("cardProgress").doc(`${user.uid}_${id}`).set({ uid: user.uid, cardId: id, status, updatedAt: now() });
    return Response.json({ status });
  } catch (error) { return jsonError(error); }
}
