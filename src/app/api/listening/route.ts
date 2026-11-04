import { requireViewer } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { ListeningAttempt, ListeningItem, ListeningSet } from "@/lib/listening";
import { active } from "@/lib/models";

export const runtime = "nodejs";
export async function GET() {
  try {
    const user = await requireViewer(), store = db();
    const [setsSnap, itemsSnap, attemptsSnap] = await Promise.all([
      store.collection("listeningSets").get(), store.collection("listeningItems").get(),
      store.collection("listeningAttempts").where("uid", "==", user.uid).get(),
    ]);
    const items = itemsSnap.docs.map(d => d.data() as ListeningItem).filter(active);
    const sets = setsSnap.docs.map(d => ({ id: d.id, ...d.data() as ListeningSet })).filter(active).map(s => ({ id: s.id, title: s.title, kind: s.kind, total: items.filter(i => i.setId === s.id).length }));
    const attempts = attemptsSnap.docs.map(d => ({ id: d.id, ...d.data() as ListeningAttempt })).sort((a, b) => b.completedAt.localeCompare(a.completedAt)).map(a => ({ id: a.id, setId: a.setId, title: a.title, kind: a.kind, correct: a.correct, total: a.total, completedAt: a.completedAt }));
    return Response.json({ sets, attempts });
  } catch (error) { return jsonError(error); }
}
