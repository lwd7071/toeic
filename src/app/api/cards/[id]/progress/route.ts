import { requireViewer, ApiError } from "@/lib/auth";
import { jsonError, requireCsrf } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { active, Card, Topic, now } from "@/lib/models";
import { qualifiedDay, studyDayRef } from "@/lib/study-store";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireCsrf();
    const user = await requireViewer();
    const { id } = await context.params;
    const { status } = await request.json();
    if (status !== "remembered" && status !== "review") throw new ApiError(400, "Trạng thái thẻ không hợp lệ.");
    const store = db();
    const updatedAt = now();
    const day = qualifiedDay(new Date(updatedAt));
    await store.runTransaction(async tx => {
      const cardDoc = await tx.get(store.collection("vocabCards").doc(id));
      const card = cardDoc.data() as Card | undefined;
      if (!card || !active(card)) throw new ApiError(404, "Không tìm thấy thẻ.");
      const topicDoc = await tx.get(store.collection("vocabTopics").doc(card.topicId));
      if (!topicDoc.exists || !active(topicDoc.data() as Topic)) throw new ApiError(404, "Chủ đề đã bị ẩn.");
      const progressRef = store.collection("cardProgress").doc(`${user.uid}_${id}`);
      const summaryRef = store.collection("topicProgress").doc(`${user.uid}_${card.topicId}`);
      const previous = await tx.get(progressRef);
      const prior = previous.data()?.status;
      tx.set(progressRef, { uid: user.uid, cardId: id, topicId: card.topicId, status, updatedAt });
      tx.set(summaryRef, { uid: user.uid, topicId: card.topicId, statuses: { [id]: status } }, { merge: true });
      if (prior !== status) tx.set(summaryRef, {
        uid: user.uid, topicId: card.topicId,
        ...(prior === "remembered" || prior === "review" ? { [prior]: FieldValue.increment(-1) } : {}),
        [status]: FieldValue.increment(1),
      }, { merge: true });
      if (prior !== status) tx.set(store.collection("userProgress").doc(user.uid), {
        ...(prior === "remembered" || prior === "review" ? { [prior]: FieldValue.increment(-1) } : {}),
        [status]: FieldValue.increment(1),
      }, { merge: true });
      if (day) tx.set(studyDayRef(user.uid, day.date), { completedAt: day.at }, { merge: true });
    });
    return Response.json({ status });
  } catch (error) { return jsonError(error); }
}
