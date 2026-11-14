import { ApiError, requireContentEditor } from "@/lib/auth";
import { jsonError, requireCsrf } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { ListeningSet, parseListeningCsv } from "@/lib/listening";
import { now } from "@/lib/models";
import { FieldValue } from "firebase-admin/firestore";
import { revalidateTag } from "next/cache";

export const runtime = "nodejs";

function duplicateQueries(store: FirebaseFirestore.Firestore, setId: string, keys: string[]) {
  const queries: FirebaseFirestore.Query[] = [];
  for (let start = 0; start < keys.length; start += 30) {
    queries.push(store.collection("listeningItems").where("setId", "==", setId).where("key", "in", keys.slice(start, start + 30)));
  }
  return queries;
}

async function handle(request: Request, commit: boolean) {
  try {
    await requireCsrf(); await requireContentEditor();
    const form = await request.formData(), setId = form.get("setId"), file = form.get("file");
    if (typeof setId !== "string" || !setId || !(file instanceof File)) throw new ApiError(400, "Thiếu bài học hoặc file CSV.");
    const store = db(), setRef = store.collection("listeningSets").doc(setId);
    const setDoc = await setRef.get();
    const set = setDoc.data() as ListeningSet | undefined;
    if (!set || set.archivedAt) throw new ApiError(404, "Bài listening không tồn tại hoặc đã ẩn.");
    const parsed = parseListeningCsv(Buffer.from(await file.arrayBuffer()), set.kind);
    if (commit && form.get("expectedHash") !== parsed.hash) throw new ApiError(409, "File đã thay đổi. Hãy xem trước lại.");
    const errors = [...parsed.errors];
    const queries = duplicateQueries(store, setId, parsed.rows.map(row => row.key));
    if (!commit) {
      const matches = await Promise.all(queries.map(query => query.get()));
      const keys = new Set(matches.flatMap(snapshot => snapshot.docs.map(doc => doc.data().key)));
      parsed.rows.forEach((row, index) => { if (keys.has(row.key)) errors.push(`Dòng ${index + 2}: media đã có trong bài (có thể đang bị ẩn).`); });
      return Response.json({ ...parsed, errors });
    }
    if (errors.length) throw new ApiError(400, errors.join("\n"));
    await store.runTransaction(async tx => {
      const current = await tx.get(setRef);
      const matches = await Promise.all(queries.map(query => tx.get(query)));
      if (!current.exists || current.data()?.archivedAt) throw new ApiError(409, "Bài đã bị ẩn.");
      if (matches.some(snapshot => !snapshot.empty)) throw new ApiError(409, "Media vừa được nhập. Hãy xem trước lại.");
      parsed.rows.forEach(row => tx.create(store.collection("listeningItems").doc(), { ...row, setId, archivedAt: null, createdAt: now() }));
      tx.update(setRef, { totalCount: FieldValue.increment(parsed.count), activeCount: FieldValue.increment(parsed.count) });
    });
    revalidateTag("content:listening");
    return Response.json({ imported: parsed.count });
  } catch (error) { return jsonError(error); }
}
export async function POST(request: Request) { return handle(request, false); }
export async function PUT(request: Request) { return handle(request, true); }
