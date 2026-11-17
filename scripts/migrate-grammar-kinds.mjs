import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { mkdir, writeFile } from "node:fs/promises";

const mode = process.argv[2];
if (mode !== "check" && mode !== "migrate") throw new Error("Dùng: node scripts/migrate-grammar-kinds.mjs check|migrate");
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!projectId) throw new Error("Thiếu NEXT_PUBLIC_FIREBASE_PROJECT_ID.");
if (!process.env.FIRESTORE_EMULATOR_HOST && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Cần service account hoặc ADC.");
initializeApp(process.env.FIRESTORE_EMULATOR_HOST ? { projectId } : { projectId, credential: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) : applicationDefault() });
const docs = (await getFirestore().collection("grammarLessons").get()).docs;
const invalid = docs.filter(doc => doc.data().kind && doc.data().kind !== "theory" && doc.data().kind !== "practice");
const pending = docs.filter(doc => !doc.data().kind);
console.log(`${invalid.length} loại không hợp lệ; ${pending.length} bài cũ cần gán theory.`);
if (invalid.length) { process.exitCode = 1; }
else if (mode === "check") { process.exitCode = pending.length ? 1 : 0; }
else if (pending.length) {
  const backupDir = `.migration-backups/grammar-kinds-${projectId}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  await mkdir(backupDir, { recursive: true });
  await writeFile(`${backupDir}/grammarLessons.json`, JSON.stringify(docs.map(doc => ({ id: doc.id, data: doc.data() })), null, 2));
  for (let i = 0; i < pending.length; i += 400) {
    const batch = getFirestore().batch();
    for (const doc of pending.slice(i, i + 400)) batch.update(doc.ref, { kind: "theory" });
    await batch.commit();
  }
  console.log(`Đã sao lưu tại ${backupDir} và cập nhật ${pending.length} bài.`);
}
