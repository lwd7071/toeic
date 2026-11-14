import { requireViewer } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { Topic } from "@/lib/models";

export const runtime = "nodejs";
export async function GET() {
  try {
    const user = await requireViewer();
    const store = db();
    const topics = await store.collection("vocabTopics").where("archivedAt", "==", null).get();
    const summaries = topics.docs.length ? await store.getAll(...topics.docs.map(d => store.collection("topicProgress").doc(`${user.uid}_${d.id}`))) : [];
    return Response.json(topics.docs.reduce((result, doc, index) => {
      result.total += (doc.data() as Topic).activeCount ?? 0;
      result.remembered += summaries[index].data()?.remembered ?? 0;
      result.review += summaries[index].data()?.review ?? 0;
      return result;
    }, { total: 0, remembered: 0, review: 0 }));
  } catch (error) { return jsonError(error); }
}
