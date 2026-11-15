import { unstable_cache } from "next/cache";
import { db } from "./firebase-admin";
import { ApiError } from "./errors";
import { searchTitle } from "./content-counts";
import { PAGE_SIZE } from "./pagination";
import { createHash } from "node:crypto";
import { Card, Exercise, Lesson, Question, Topic } from "./models";
import { ListeningItem, ListeningSet } from "./listening";

const TTL = 900;

async function page(collectionName: string, limit: number, token: string, search = "") {
  const collection = db().collection(collectionName);
  const query = search
    ? collection.where("archivedAt", "==", null).orderBy("searchTitle").orderBy("__name__").startAt(search).endAt(search + "\uf8ff")
    : collection.where("archivedAt", "==", null).orderBy("__name__");
  const cursor = token ? await collection.doc(token).get() : null;
  if (cursor && (!cursor.exists || cursor.data()?.archivedAt || (search && !String(cursor.data()?.searchTitle).startsWith(search)))) throw new ApiError(400, "Trang không hợp lệ.");
  const snapshot = await (cursor ? query.startAfter(cursor) : query).limit(limit === 3 ? 3 : limit + 1).get();
  const docs = snapshot.docs.slice(0, limit);
  return { items: docs.map(d => ({ id: d.id, ...d.data() })), nextPageToken: snapshot.size > limit ? docs.at(-1)!.id : null };
}

export const cachedTopics = unstable_cache(
  async (limit: number, token: string, search: string) => page("vocabTopics", limit, token, searchTitle(search)),
  ["content-v3", "topics"], { tags: ["content:topics"], revalidate: TTL },
);
export const cachedLessons = unstable_cache(
  async (limit: number, token: string) => page("grammarLessons", limit, token),
  ["content-v3", "lessons"], { tags: ["content:lessons"], revalidate: TTL },
);
export const cachedListening = unstable_cache(
  async (limit: number, token: string) => page("listeningSets", limit, token),
  ["content-v3", "listening"], { tags: ["content:listening"], revalidate: TTL },
);

export const cachedCards = unstable_cache(async (topicId: string) => {
  const store = db();
  const topic = await store.collection("vocabTopics").doc(topicId).get();
  if (!topic.exists || topic.data()?.archivedAt) return { topic: topic.exists ? { id: topic.id, ...topic.data() as Topic } : null, cards: [] as (Card & { id: string })[] };
  const cards = await store.collection("vocabCards").where("topicId", "==", topicId).get();
  return { topic: topic.exists ? { id: topic.id, ...topic.data() as Topic } : null,
    cards: cards.docs.map(d => ({ id: d.id, ...d.data() as Card })) };
}, ["content-v3", "cards"], { tags: ["content:topics"], revalidate: TTL });

export const cachedLesson = unstable_cache(async (id: string) => {
  const doc = await db().collection("grammarLessons").doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() as Lesson } : null;
}, ["content-v3", "lesson"], { tags: ["content:lessons"], revalidate: TTL });

export const cachedExercise = unstable_cache(async (id: string) => {
  const doc = await db().collection("grammarExercises").doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() as Exercise } : null;
}, ["content-v3", "exercise"], { tags: ["content:lessons"], revalidate: TTL });

export const cachedExercises = unstable_cache(async (lessonId: string, token: string) => {
  const query = db().collection("grammarExercises").where("lessonId", "==", lessonId).where("archivedAt", "==", null).orderBy("__name__");
  const snapshot = await (token ? query.startAfter(token) : query).limit(PAGE_SIZE + 1).get();
  const docs = snapshot.docs.slice(0, PAGE_SIZE);
  return { items: docs.map(d => ({ id: d.id, ...d.data() as Exercise })), nextPageToken: snapshot.size > PAGE_SIZE ? docs.at(-1)!.id : null };
}, ["content-v3", "exercises"], { tags: ["content:lessons"], revalidate: TTL });

export const cachedQuestions = unstable_cache(async (exerciseId: string) => {
  const snap = await db().collection("grammarQuestions").where("exerciseId", "==", exerciseId).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() as Question }));
}, ["content-v3", "questions"], { tags: ["content:lessons"], revalidate: TTL });

export async function exerciseQuestions(exerciseId: string) {
  const questions = (await cachedQuestions(exerciseId) as (Question & { id: string })[])
    .filter(q => !q.archivedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const version = createHash("sha256").update(JSON.stringify(questions)).digest("hex");
  return { questions, version };
}

export const cachedListeningSet = unstable_cache(async (id: string) => {
  const store = db();
  const set = await store.collection("listeningSets").doc(id).get();
  if (!set.exists) return null;
  const snap = await store.collection("listeningItems").where("setId", "==", id).get();
  return { set: { id: set.id, ...set.data() as ListeningSet }, items: snap.docs.map(d => ({ id: d.id, ...d.data() as ListeningItem })) };
}, ["content-v3", "listening-set"], { tags: ["content:listening"], revalidate: TTL });

export const cachedCardTotal = unstable_cache(async () => {
  const snap = await db().collection("vocabTopics").where("archivedAt", "==", null).get();
  return snap.docs.reduce((total, doc) => total + (doc.data().activeCount ?? 0), 0);
}, ["content-v3", "card-total"], { tags: ["content:topics"], revalidate: TTL });
