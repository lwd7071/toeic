import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!projectId) throw new Error("Thiếu NEXT_PUBLIC_FIREBASE_PROJECT_ID.");
if (!process.env.FIRESTORE_EMULATOR_HOST && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  throw new Error("Cần FIREBASE_SERVICE_ACCOUNT_JSON để chuyển dữ liệu thật.");
}

initializeApp({ projectId, credential: process.env.FIRESTORE_EMULATOR_HOST ? undefined : cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
const store = getFirestore();
const lessons = await store.collection("grammarLessons").get();
const questions = await store.collection("grammarQuestions").get();
const existing = await store.collection("grammarExercises").get();
const exerciseIds = new Set(existing.docs.map(doc => doc.id));
const writes = [];

for (const lesson of lessons.docs) {
  const id = `default_${lesson.id}`;
  if (!exerciseIds.has(id)) writes.push({ ref: store.collection("grammarExercises").doc(id), value: { lessonId: lesson.id, title: "Bài tập 1", archivedAt: null, createdAt: lesson.data().createdAt ?? new Date().toISOString() }, merge: false });
}
for (const question of questions.docs) {
  if (!question.data().exerciseId) writes.push({ ref: question.ref, value: { exerciseId: `default_${question.data().lessonId}` }, merge: true });
}

for (let i = 0; i < writes.length; i += 400) {
  const batch = store.batch();
  for (const write of writes.slice(i, i + 400)) batch.set(write.ref, write.value, { merge: write.merge });
  await batch.commit();
}
console.log(`Đã xử lý ${lessons.size} bài ngữ pháp và ${questions.size} câu hỏi; ghi ${writes.length} thay đổi.`);
