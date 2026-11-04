import { ApiError, requireViewer } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { ListeningAttempt } from "@/lib/listening";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireViewer(), { id } = await context.params;
    const store = db(), attempt = (await store.collection("listeningAttempts").doc(id).get()).data() as ListeningAttempt | undefined;
    if (!attempt || attempt.uid !== user.uid) throw new ApiError(404, "Không tìm thấy kết quả.");
    const answers = (await store.collection("listeningAnswers").where("attemptId", "==", id).get()).docs.map(d => d.data()).sort((a, b) => a.index - b.index).map(({ index, attemptId, uid, ...answer }) => answer);
    return Response.json({ id, ...attempt, answers });
  } catch (error) { return jsonError(error); }
}
