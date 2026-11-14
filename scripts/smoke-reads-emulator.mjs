import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Chỉ chạy script này với Firestore Emulator.");
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-miu-toeic";
initializeApp({ projectId });
const store = getFirestore();
const topic = store.collection("vocabTopics").doc("smoke-topic");
await topic.set({ title: "Công sở", searchTitle: "công sở", archivedAt: null, totalCount: 0, activeCount: 0 });
for (let start = 0; start < 3000; start += 400) {
  const batch = store.batch();
  for (let i = start; i < Math.min(start + 400, 3000); i++) {
    batch.set(store.collection("vocabCards").doc(`smoke-card-${String(i).padStart(4, "0")}`), { topicId: topic.id, english: `word ${i}`, vietnamese: `nghĩa ${i}`, archivedAt: null });
  }
  await batch.commit();
}
const topics = await store.collection("vocabTopics").where("archivedAt", "==", null).orderBy("searchTitle").orderBy("__name__").startAt("công").endAt("công\uf8ff").limit(21).get();
const cards = store.collection("vocabCards").where("topicId", "==", topic.id).orderBy("__name__");
const first = await cards.limit(21).get();
const second = await cards.startAfter(first.docs[19].id).limit(21).get();
if (topics.docs[0]?.id !== topic.id || first.size !== 21 || second.size !== 21 || second.docs[0].id === first.docs[0].id) throw new Error("Truy vấn tiền tố/cursor không đúng.");
console.log(JSON.stringify({ seededCards: 3000, prefixResults: topics.size, firstPageReads: first.size, secondPageReads: second.size, firstOnNextPage: second.docs[0].id }));
await store.terminate();
