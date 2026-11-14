import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const mode = process.argv[2];
if (mode !== "check" && mode !== "repair") throw new Error("Dùng: node scripts/reconcile-counts.mjs check|repair");
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!projectId) throw new Error("Thiếu NEXT_PUBLIC_FIREBASE_PROJECT_ID.");
if (!process.env.FIRESTORE_EMULATOR_HOST && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error("Cần FIREBASE_SERVICE_ACCOUNT_JSON để kiểm tra dữ liệu thật.");
initializeApp(process.env.FIRESTORE_EMULATOR_HOST ? { projectId } : { projectId, credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
const store = getFirestore();
const names = ["vocabTopics", "vocabCards", "grammarLessons", "grammarExercises", "grammarQuestions", "listeningSets", "listeningItems", "cardProgress", "topicProgress", "userProgress", "quizAttempts"];
const snapshots = await Promise.all(names.map(name => store.collection(name).get()));
const data = Object.fromEntries(names.map((name, index) => [name, snapshots[index].docs]));
const byId = name => new Map(data[name].map(doc => [doc.id, doc]));
const topics = byId("vocabTopics"), cards = byId("vocabCards"), exercises = byId("grammarExercises"), lessons = byId("grammarLessons");
const expected = new Map();
const add = (ref, values) => {
  const key = ref.path;
  const entry = expected.get(key) ?? { ref, values: {} };
  Object.assign(entry.values, values);
  expected.set(key, entry);
};
const increment = (ref, field) => {
  const key = ref.path;
  const entry = expected.get(key);
  entry.values[field] = (entry.values[field] ?? 0) + 1;
};
for (const doc of data.vocabTopics) add(doc.ref, { totalCount: 0, activeCount: 0, searchTitle: doc.data().title.trim().normalize("NFC").toLocaleLowerCase("vi") });
for (const doc of data.grammarLessons) add(doc.ref, { totalCount: 0, activeCount: 0 });
for (const doc of data.grammarExercises) add(doc.ref, { totalCount: 0, activeCount: 0 });
for (const doc of data.listeningSets) add(doc.ref, { totalCount: 0, activeCount: 0 });
for (const doc of data.vocabCards) {
  const parent = topics.get(doc.data().topicId);
  if (!parent) continue;
  increment(parent.ref, "totalCount");
  if (!doc.data().archivedAt) increment(parent.ref, "activeCount");
}
for (const doc of data.grammarQuestions) {
  const exercise = exercises.get(doc.data().exerciseId);
  const lesson = lessons.get(doc.data().lessonId);
  if (exercise) {
    increment(exercise.ref, "totalCount");
    if (!doc.data().archivedAt) increment(exercise.ref, "activeCount");
  }
  if (lesson) {
    increment(lesson.ref, "totalCount");
    if (!doc.data().archivedAt && exercise && !exercise.data().archivedAt) increment(lesson.ref, "activeCount");
  }
}
const sets = byId("listeningSets");
for (const doc of data.listeningItems) {
  const parent = sets.get(doc.data().setId);
  if (!parent) continue;
  increment(parent.ref, "totalCount");
  if (!doc.data().archivedAt) increment(parent.ref, "activeCount");
}
for (const doc of data.topicProgress) add(doc.ref, { remembered: 0, review: 0 });
for (const doc of data.userProgress) add(doc.ref, { remembered: 0, review: 0 });
for (const doc of data.cardProgress) {
  const card = cards.get(doc.data().cardId);
  if (!card) continue;
  const topicId = card.data().topicId;
  add(doc.ref, { topicId });
  const status = doc.data().status;
  if (card.data().archivedAt || (status !== "remembered" && status !== "review")) continue;
  const summaryRef = store.collection("topicProgress").doc(`${doc.data().uid}_${topicId}`);
  if (!expected.has(summaryRef.path)) add(summaryRef, { uid: doc.data().uid, topicId, remembered: 0, review: 0 });
  increment(summaryRef, status);
  if (!topics.get(topicId)?.data().archivedAt) {
    const userRef = store.collection("userProgress").doc(doc.data().uid);
    if (!expected.has(userRef.path)) add(userRef, { remembered: 0, review: 0 });
    increment(userRef, status);
  }
}
for (const doc of data.quizAttempts) if (!doc.data().exerciseId && doc.data().lessonId) add(doc.ref, { exerciseId: `default_${doc.data().lessonId}` });
const changes = [...expected.values()].filter(({ ref, values }) => {
  const existing = snapshots[names.indexOf(ref.parent.id)]?.docs.find(doc => doc.id === ref.id)?.data() ?? {};
  return Object.entries(values).some(([key, value]) => existing[key] !== value);
});
for (const { ref, values } of changes.slice(0, 50)) console.log(`${ref.parent.id}/${ref.parent.id === "topicProgress" || ref.parent.id === "userProgress" ? "<user>" : ref.id}: ${JSON.stringify(values)}`);
console.log(`${mode}: ${changes.length} tài liệu lệch${changes.length > 50 ? " (chỉ hiện 50 đầu)" : ""}.`);
if (mode === "check") process.exitCode = changes.length ? 1 : 0;
else {
  for (let i = 0; i < changes.length; i += 400) {
    const batch = store.batch();
    for (const { ref, values } of changes.slice(i, i + 400)) batch.set(ref, values, { merge: true });
    await batch.commit();
  }
  console.log(`Đã sửa ${changes.length} tài liệu.`);
}
await store.terminate();
