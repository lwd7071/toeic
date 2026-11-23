import { requireContentEditor, ApiError } from "@/lib/auth";
import { jsonError, requireCsrf, textField } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { now } from "@/lib/models";
import { searchTitle } from "@/lib/content-counts";
import { revalidateTag } from "next/cache";
import { firestorePage } from "@/lib/pagination";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const user = await requireContentEditor();
    const store = db();
    const params = new URL(request.url).searchParams;
    const tab = params.get("tab") === "questions" ? "questions" : "cards";
    const grammarKind = params.get("grammarKind") ?? "theory";
    if (tab === "questions" && grammarKind !== "theory" && grammarKind !== "practice") throw new ApiError(400, "Loại bài ngữ pháp không hợp lệ.");
    const parentsQuery = () => tab === "cards" ? store.collection("vocabTopics") : store.collection("grammarLessons").where("kind", "==", grammarKind);
    const token = (key: string) => { const value = params.get(key) ?? ""; if (value && !/^[\w-]{1,200}$/.test(value)) throw new ApiError(400, "Trang không hợp lệ."); return value; };
    const section = params.get("section");
    if (section) {
      const rows = (docs: FirebaseFirestore.QueryDocumentSnapshot[]) => docs.map(d => ({ id: d.id, ...d.data() }));
      if (section === "parents") {
        const page = await firestorePage(parentsQuery(), token("parents"));
        return Response.json({ parents: rows(page.docs), parentNextToken: page.nextPageToken, isBot: user.isBot });
      }
      const id = token("selected"), exerciseId = token("exercise");
      if (section === "exercises") {
        if (!id) return Response.json({ current: null, exercises: [], exerciseNextToken: null, currentExercise: null });
        const parent = await store.collection(tab === "cards" ? "vocabTopics" : "grammarLessons").doc(id).get();
        const current = parent.exists ? { id: parent.id, ...parent.data() } : null;
        const page = tab === "questions" && current ? await firestorePage(store.collection("grammarExercises").where("lessonId", "==", id), token("exercises")) : null;
        const chosen = exerciseId && page ? page.docs.find(d => d.id === exerciseId) ?? await store.collection("grammarExercises").doc(exerciseId).get() : page?.docs[0];
        const currentExercise = chosen?.exists && chosen.data()?.lessonId === id ? { id: chosen.id, ...chosen.data() } : null;
        return Response.json({ current, exercises: rows(page?.docs ?? []), exerciseNextToken: page?.nextPageToken ?? null, currentExercise });
      }
      if (section === "items") {
        const owner = tab === "cards" ? id : exerciseId;
        if (!owner) return Response.json({ children: [], childNextToken: null });
        const query = tab === "cards" ? store.collection("vocabCards").where("topicId", "==", owner) : store.collection("grammarQuestions").where("exerciseId", "==", owner);
        const page = await firestorePage(query, token("children"));
        return Response.json({ children: rows(page.docs), childNextToken: page.nextPageToken });
      }
      throw new ApiError(400, "Phần danh sách không hợp lệ.");
    }
    const id = token("selected"), exerciseId = token("exercise");
    const parentCollection = store.collection(tab === "cards" ? "vocabTopics" : "grammarLessons");
    const parentPage = await firestorePage(tab === "cards" ? parentCollection : parentCollection.where("kind", "==", grammarKind), token("parents"));
    const selectedDoc = id ? parentPage.docs.find(d => d.id === id) ?? await parentCollection.doc(id).get() : parentPage.docs[0];
    const current = selectedDoc?.exists ? { id: selectedDoc.id, ...selectedDoc.data() } : null;
    const exercisePage = tab === "questions" && current ? await firestorePage(store.collection("grammarExercises").where("lessonId", "==", current.id), token("exercises")) : null;
    const chosenExercise = exerciseId && exercisePage ? exercisePage.docs.find(d => d.id === exerciseId) ?? await store.collection("grammarExercises").doc(exerciseId).get() : exercisePage?.docs[0];
    const currentExercise = chosenExercise?.exists && chosenExercise.data()?.lessonId === current?.id ? { id: chosenExercise.id, ...chosenExercise.data() } : null;
    const childQuery = current ? tab === "cards" ? store.collection("vocabCards").where("topicId", "==", current.id) : currentExercise ? store.collection("grammarQuestions").where("exerciseId", "==", currentExercise.id) : null : null;
    const childPage = childQuery ? await firestorePage(childQuery, token("children")) : null;
    const rows = (docs: FirebaseFirestore.QueryDocumentSnapshot[]) => docs.map(d => ({ id: d.id, ...d.data() }));
    return Response.json({ tab, parentsToken: token("parents"), selected: current?.id ?? "", parents: rows(parentPage.docs), parentNextToken: parentPage.nextPageToken, current, exercises: rows(exercisePage?.docs ?? []), exerciseNextToken: exercisePage?.nextPageToken ?? null, currentExercise, children: rows(childPage?.docs ?? []), childNextToken: childPage?.nextPageToken ?? null, isBot: user.isBot });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    await requireCsrf();
    await requireContentEditor();
    const body = await request.json();
    const title = textField(body.title, "Tên", 120);
    const store = db();
    if (body.kind === "topic") {
      const ref = store.collection("vocabTopics").doc();
      const batch = store.batch();
      batch.create(ref, { title, searchTitle: searchTitle(title), totalCount: 0, activeCount: 0, archivedAt: null, createdAt: now() });
      batch.create(store.collection("vocabDecks").doc(ref.id), { title, archivedAt: null, cards: [] });
      await batch.commit();
      revalidateTag("content:topics");
      return Response.json({ id: ref.id });
    }
    if (body.kind === "lesson") {
      if (body.lessonKind !== "theory" && body.lessonKind !== "practice") throw new ApiError(400, "Hãy chọn loại bài ngữ pháp.");
      const theory = typeof body.theory === "string" ? body.theory.trim() : "";
      if (theory.length > 20000) throw new ApiError(400, "Lý thuyết quá dài.");
      if (body.lessonKind === "practice" && theory) throw new ApiError(400, "Bài tập thuần không có lý thuyết.");
      const ref = store.collection("grammarLessons").doc();
      const batch = store.batch();
      const createdAt = now();
      batch.create(ref, { title, theory, kind: body.lessonKind, totalCount: 0, activeCount: 0, archivedAt: null, createdAt });
      batch.create(store.collection("grammarExercises").doc(`default_${ref.id}`), { lessonId: ref.id, title: body.lessonKind === "practice" ? title : "Bài tập 1", totalCount: 0, activeCount: 0, archivedAt: null, createdAt });
      await batch.commit();
      revalidateTag("content:lessons");
      return Response.json({ id: ref.id });
    }
    if (body.kind === "exercise") {
      const lessonId = body.lessonId;
      if (typeof lessonId !== "string" || !lessonId) throw new ApiError(400, "Thiếu bài ngữ pháp.");
      const lesson = await store.collection("grammarLessons").doc(lessonId).get();
      if (!lesson.exists || lesson.data()?.archivedAt) throw new ApiError(404, "Bài ngữ pháp đã bị ẩn.");
      if (lesson.data()?.kind === "practice") throw new ApiError(400, "Bài tập thuần chỉ có một bộ câu hỏi.");
      const ref = await store.collection("grammarExercises").add({ lessonId, title, totalCount: 0, activeCount: 0, archivedAt: null, createdAt: now() });
      revalidateTag("content:lessons");
      return Response.json({ id: ref.id });
    }
    throw new ApiError(400, "Loại nội dung không hợp lệ.");
  } catch (error) { return jsonError(error); }
}
