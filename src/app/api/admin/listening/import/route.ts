import { ApiError, requireAdmin } from "@/lib/auth";
import { jsonError, requireCsrf } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { ListeningSet, parseListeningCsv } from "@/lib/listening";
import { now } from "@/lib/models";

export const runtime = "nodejs";
async function handle(request: Request, commit: boolean) {
  try {
    await requireCsrf(); await requireAdmin();
    const form = await request.formData(), setId = form.get("setId"), file = form.get("file");
    if (typeof setId !== "string" || !setId || !(file instanceof File)) throw new ApiError(400, "Thiếu bài học hoặc file CSV.");
    const store = db(), setRef = store.collection("listeningSets").doc(setId), setDoc = await setRef.get();
    const set = setDoc.data() as ListeningSet | undefined;
    if (!set || set.archivedAt) throw new ApiError(404, "Bài listening không tồn tại hoặc đã ẩn.");
    const parsed = parseListeningCsv(Buffer.from(await file.arrayBuffer()), set.kind);
    if (commit && form.get("expectedHash") !== parsed.hash) throw new ApiError(409, "File đã thay đổi. Hãy xem trước lại.");
    const existing = await store.collection("listeningItems").where("setId", "==", setId).get();
    const keys = new Set(existing.docs.map(d => d.data().key));
    const errors = [...parsed.errors];
    parsed.rows.forEach((row, index) => { if (keys.has(row.key)) errors.push(`Dòng ${index + 2}: media đã có trong bài (có thể đang bị ẩn).`); });
    if (!commit) return Response.json({ ...parsed, errors });
    if (errors.length) throw new ApiError(400, errors.join("\n"));
    await store.runTransaction(async tx => {
      const current = await tx.get(setRef);
      const latest = await tx.get(store.collection("listeningItems").where("setId", "==", setId));
      if (!current.exists || current.data()?.archivedAt) throw new ApiError(409, "Bài đã bị ẩn.");
      if (latest.docs.some(d => parsed.rows.some(row => row.key === d.data().key))) throw new ApiError(409, "Media vừa được nhập. Hãy xem trước lại.");
      parsed.rows.forEach(row => tx.create(store.collection("listeningItems").doc(), { ...row, setId, archivedAt: null, createdAt: now() }));
    });
    return Response.json({ imported: parsed.count });
  } catch (error) { return jsonError(error); }
}
export async function POST(request: Request) { return handle(request, false); }
export async function PUT(request: Request) { return handle(request, true); }
