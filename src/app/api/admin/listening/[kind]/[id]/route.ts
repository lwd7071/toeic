import { ApiError, requireAdmin } from "@/lib/auth";
import { jsonError, nullableArchive, requireCsrf, textField } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { driveLink, ListeningItem, ListeningSet } from "@/lib/listening";

export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ kind: string; id: string }> }) {
  try {
    await requireCsrf(); await requireAdmin();
    const { kind, id } = await context.params;
    if (kind !== "set" && kind !== "item") throw new ApiError(400, "Loại nội dung không hợp lệ.");
    const store = db(), ref = store.collection(kind === "set" ? "listeningSets" : "listeningItems").doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new ApiError(404, "Không tìm thấy nội dung.");
    const body = await request.json();
    if (typeof body.archive === "boolean") {
      await ref.update({ archivedAt: nullableArchive(body.archive) });
    } else if (kind === "set") {
      await ref.update({ title: textField(body.title, "Tên bài", 120) });
    } else {
      const item = doc.data() as ListeningItem;
      const set = await store.collection("listeningSets").doc(item.setId).get();
      if (!set.exists) throw new ApiError(409, "Bài học không còn tồn tại.");
      const { kind: setKind } = set.data() as ListeningSet;
      const audioUrl = driveLink(textField(body.audioUrl, "Link audio", 1000)).viewUrl;
      const imageUrl = setKind === "picture" ? driveLink(textField(body.imageUrl, "Link ảnh", 1000)).viewUrl : undefined;
      const key = `${imageUrl ?? ""}\u0000${audioUrl}`;
      const duplicate = await store.collection("listeningItems").where("setId", "==", item.setId).get();
      if (duplicate.docs.some(d => d.id !== id && d.data().key === key)) throw new ApiError(409, "Media đã có trong bài.");
      if (setKind === "dictation") await ref.update({ audioUrl, transcript: textField(body.transcript, "Câu chép", 1000), key });
      else {
        if (!["A", "B", "C", "D"].includes(body.correctAnswer)) throw new ApiError(400, "Đáp án đúng không hợp lệ.");
        await ref.update({ imageUrl, audioUrl, A: textField(body.A, "A", 1000), B: textField(body.B, "B", 1000), C: textField(body.C, "C", 1000), D: textField(body.D, "D", 1000), correctAnswer: body.correctAnswer, key });
      }
    }
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}
