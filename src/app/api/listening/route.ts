import { requireViewer } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { ListeningAttempt, ListeningSet } from "@/lib/listening";
import { cachedListening } from "@/lib/cached-content";
import { PAGE_SIZE, pageToken } from "@/lib/pagination";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const user = await requireViewer(), store = db();
    const page = await cachedListening(PAGE_SIZE, pageToken(request));
    const attemptsSnap = await store.collection("listeningAttempts").where("uid", "==", user.uid).orderBy("completedAt", "desc").limit(PAGE_SIZE).get();
    const sets = page.items.map(item => {
      const set = item as unknown as ListeningSet;
      return { id: item.id, title: set.title, kind: set.kind, total: set.activeCount ?? 0 };
    });
    const attempts = attemptsSnap.docs.map(doc => {
      const attempt = doc.data() as ListeningAttempt;
      return { id: doc.id, setId: attempt.setId, title: attempt.title, kind: attempt.kind, correct: attempt.correct, total: attempt.total, completedAt: attempt.completedAt };
    });
    return Response.json({ sets, attempts, nextPageToken: page.nextPageToken }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}
