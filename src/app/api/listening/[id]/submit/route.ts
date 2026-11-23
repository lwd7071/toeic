import { ApiError, requireViewer } from "@/lib/auth";
import { jsonError, requireCsrf } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { ListeningAttempt, ListeningItem, ListeningSet, normalizedTranscript } from "@/lib/listening";
import { active, now } from "@/lib/models";
import { qualifiedDay, studyDayRef } from "@/lib/study-store";
import { cachedListeningSet } from "@/lib/cached-content";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireCsrf();
    const user = await requireViewer(), { id } = await context.params, store = db();
    const bundle = await cachedListeningSet(id);
    const set = bundle?.set as ListeningSet | undefined;
    if (!set || !active(set)) throw new ApiError(404, "Không tìm thấy bài listening.");
    const items = (bundle!.items as (ListeningItem & { id: string })[]).filter(active).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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
    const ref = store.collection("listeningAttempts").doc();
    const day = qualifiedDay(new Date(attempt.completedAt));
    // Chia nhỏ WriteBatch (<= 450 writes/batch) để không vượt giới hạn 500 writes của Firestore
    const CHUNK = 450;
    for (let start = 0; start < answers.length; start += CHUNK) {
      const batch = store.batch();
      if (start === 0) {
        batch.create(ref, attempt);
        if (day) batch.set(studyDayRef(user.uid, day.date), { completedAt: day.at }, { merge: true });
      }
      answers.slice(start, start + CHUNK).forEach((answer, offset) =>
        batch.create(store.collection("listeningAnswers").doc(), { ...answer, attemptId: ref.id, uid: user.uid, index: start + offset }),
      );
      await batch.commit();
    }
    return Response.json({ id: ref.id, ...attempt, answers });
  } catch (error) { return jsonError(error); }
}
