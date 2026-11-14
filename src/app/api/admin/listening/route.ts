import { ApiError, requireContentEditor } from "@/lib/auth";
import { jsonError, requireCsrf, textField } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { ListeningKind } from "@/lib/listening";
import { now } from "@/lib/models";
import { revalidateTag } from "next/cache";
import { firestorePage } from "@/lib/pagination";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const user = await requireContentEditor();
    const store = db();
    const params = new URL(request.url).searchParams;
    const token = (key: string) => { const value = params.get(key) ?? ""; if (value && !/^[\w-]{1,200}$/.test(value)) throw new ApiError(400, "Trang không hợp lệ."); return value; };
    const setCollection = store.collection("listeningSets");
    const sets = await firestorePage(setCollection, token("sets"));
    const selectedId = token("selected");
    const selected = selectedId ? sets.docs.find(d => d.id === selectedId) ?? await setCollection.doc(selectedId).get() : sets.docs[0];
    const current = selected?.exists ? { id: selected.id, ...selected.data() } : null;
    const items = current ? await firestorePage(store.collection("listeningItems").where("setId", "==", current.id), token("items")) : null;
    return Response.json({ setsToken: token("sets"), sets: sets.docs.map(d => ({ id: d.id, ...d.data() })), setsNextToken: sets.nextPageToken, current, items: items?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [], itemsNextToken: items?.nextPageToken ?? null, isBot: user.isBot });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    await requireCsrf(); await requireContentEditor();
    const body = await request.json();
    const title = textField(body.title, "Tên bài", 120);
    if (body.kind !== "dictation" && body.kind !== "picture") throw new ApiError(400, "Dạng bài không hợp lệ.");
    const ref = await db().collection("listeningSets").add({ title, kind: body.kind as ListeningKind, totalCount: 0, activeCount: 0, archivedAt: null, createdAt: now() });
    revalidateTag("content:listening");
    return Response.json({ id: ref.id });
  } catch (error) { return jsonError(error); }
}
