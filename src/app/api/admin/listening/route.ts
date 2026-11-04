import { ApiError, requireAdmin } from "@/lib/auth";
import { jsonError, requireCsrf, textField } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { ListeningKind } from "@/lib/listening";
import { now } from "@/lib/models";

export const runtime = "nodejs";
export async function GET() {
  try {
    await requireAdmin();
    const store = db();
    const [sets, items] = await Promise.all([store.collection("listeningSets").get(), store.collection("listeningItems").get()]);
    return Response.json({ sets: sets.docs.map(d => ({ id: d.id, ...d.data() })), items: items.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    await requireCsrf(); await requireAdmin();
    const body = await request.json();
    const title = textField(body.title, "Tên bài", 120);
    if (body.kind !== "dictation" && body.kind !== "picture") throw new ApiError(400, "Dạng bài không hợp lệ.");
    const ref = await db().collection("listeningSets").add({ title, kind: body.kind as ListeningKind, archivedAt: null, createdAt: now() });
    return Response.json({ id: ref.id });
  } catch (error) { return jsonError(error); }
}
