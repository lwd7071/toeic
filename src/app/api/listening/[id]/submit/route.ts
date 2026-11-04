import { ApiError, requireViewer } from "@/lib/auth";
import { jsonError, requireCsrf } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { ListeningAttempt, ListeningItem, ListeningSet, normalizedTranscript } from "@/lib/listening";
import { active, now } from "@/lib/models";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireCsrf();
    const user = await requireViewer(), { id } = await context.params, store = db();
    const set = (await store.collection("listeningSets").doc(id).get()).data() as ListeningSet | undefined;
    if (!set || !active(set)) throw new ApiError(404, "Không tìm thấy bài listening.");
    const snap = await store.collection("listeningItems").where("setId", "==", id).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() as ListeningItem })).filter(active).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (!items.length) throw new ApiError(400, "Bài chưa có câu hỏi.");
    const body = await request.json(), responses = body.responses;
    if (!Array.isArray(responses) || responses.length !== items.length || responses.some(r => !r || typeof r.id !== "string" || typeof r.selected !== "string" || r.selected.length > 1000)) throw new ApiError(400, "Hãy trả lời đủ các câu trong bài.");
    const submitted = new Map<string, string>();
    for (const r of responses) {
      if (submitted.has(r.id)) throw new ApiError(400, "Câu trả lời bị trùng.");
      submitted.set(r.id, r.selected.trim());
    }
    if (items.some(i => !submitted.get(i.id))) throw new ApiError(400, "Hãy trả lời đủ các câu trong bài.");
    const answers = items.map(i => {
      const selected = submitted.get(i.id)!;
      if (set.kind === "picture" && !["A", "B", "C", "D"].includes(selected)) throw new ApiError(400, "Lựa chọn không hợp lệ.");
      const expected = set.kind === "dictation" ? i.transcript! : i.correctAnswer!;
      return { id: i.id, selected, correct: set.kind === "dictation" ? normalizedTranscript(selected) === normalizedTranscript(expected) : selected === expected, expected, ...(set.kind === "picture" ? { A: i.A, B: i.B, C: i.C, D: i.D } : {}) };
    });
    const attempt: ListeningAttempt = { uid: user.uid, setId: id, title: set.title, kind: set.kind, correct: answers.filter(a => a.correct).length, total: items.length, completedAt: now() };
    const ref = store.collection("listeningAttempts").doc(), batch = store.batch();
    batch.create(ref, attempt);
    answers.forEach((answer, index) => batch.create(store.collection("listeningAnswers").doc(), { ...answer, attemptId: ref.id, uid: user.uid, index }));
    await batch.commit();
    return Response.json({ id: ref.id, ...attempt, answers });
  } catch (error) { return jsonError(error); }
}
