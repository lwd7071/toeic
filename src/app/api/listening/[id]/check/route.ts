import { ApiError, requireViewer } from "@/lib/auth";
import { jsonError, requireCsrf } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { ListeningItem, ListeningSet, normalizedTranscript } from "@/lib/listening";
import { active } from "@/lib/models";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireCsrf();
    await requireViewer();
    const { id } = await context.params;
    const body = await request.json();
    if (!body || typeof body.itemId !== "string" || !body.itemId.trim() || typeof body.selected !== "string" || !body.selected.trim() || body.selected.length > 1000) {
      throw new ApiError(400, "Hãy nhập câu ní nghe được.");
    }
    const store = db();
    const set = (await store.collection("listeningSets").doc(id).get()).data() as ListeningSet | undefined;
    if (!set || !active(set) || set.kind !== "dictation") throw new ApiError(404, "Không tìm thấy bài nghe chép.");
    const item = (await store.collection("listeningItems").doc(body.itemId).get()).data() as ListeningItem | undefined;
    if (!item || !active(item) || item.setId !== id) throw new ApiError(404, "Không tìm thấy câu hỏi.");
    const expected = item.transcript!;
    return Response.json({ correct: normalizedTranscript(body.selected) === normalizedTranscript(expected), expected });
  } catch (error) { return jsonError(error); }
}
