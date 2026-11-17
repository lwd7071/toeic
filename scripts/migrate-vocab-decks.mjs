import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { mkdir, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";

const mode = process.argv[2];
if (mode !== "check" && mode !== "migrate") throw new Error("Dùng: node scripts/migrate-vocab-decks.mjs check|migrate");
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!projectId) throw new Error("Thiếu NEXT_PUBLIC_FIREBASE_PROJECT_ID.");
if (!process.env.FIRESTORE_EMULATOR_HOST && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Cần service account hoặc ADC.");
initializeApp(process.env.FIRESTORE_EMULATOR_HOST ? { projectId } : { projectId, credential: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) : applicationDefault() });
const store = getFirestore();
const names = ["vocabTopics", "vocabCards", "vocabDecks", "cardProgress", "topicProgress"];
const snapshots = Object.fromEntries(await Promise.all(names.map(async name => [name, (await store.collection(name).get()).docs])));
const existing = new Map(snapshots.vocabDecks.map(doc => [doc.id, doc]));
const cards = new Map();
for (const doc of snapshots.vocabCards) {
  const topicId = doc.data().topicId;
  if (!cards.has(topicId)) cards.set(topicId, []);
  cards.get(topicId).push({ id: doc.id, ...doc.data() });
}
const statuses = new Map();
for (const doc of snapshots.cardProgress) {
  const { uid, topicId, cardId, status } = doc.data();
  if (!uid || !topicId || !cardId || (status !== "review" && status !== "remembered")) continue;
  const id = `${uid}_${topicId}`;
  if (!statuses.has(id)) statuses.set(id, {});
  statuses.get(id)[cardId] = status;
}
const changes = [];
const errors = [];
for (const topic of snapshots.vocabTopics) {
  const { title, archivedAt } = topic.data();
  const deck = { title, archivedAt, cards: cards.get(topic.id) ?? [] };
  if (Buffer.byteLength(JSON.stringify(deck), "utf8") > 900 * 1024) errors.push(`Chủ đề ${topic.id} vượt giới hạn bộ thẻ.`);
  if (deck.cards.length !== (topic.data().totalCount ?? 0)) errors.push(`Chủ đề ${topic.id} có bộ đếm sai.`);
  if (!isDeepStrictEqual(existing.get(topic.id)?.data(), deck)) changes.push({ ref: store.collection("vocabDecks").doc(topic.id), value: deck, create: !existing.has(topic.id) });
}
for (const [id, value] of statuses) {
  const doc = snapshots.topicProgress.find(doc => doc.id === id);
  if (!doc) errors.push(`Thiếu topicProgress ${id}.`);
  else if (!isDeepStrictEqual(doc.data().statuses ?? {}, value)) changes.push({ ref: doc.ref, value: { statuses: value }, create: false, replaceStatuses: true });
}
for (const doc of snapshots.topicProgress) if (!statuses.has(doc.id) && Object.keys(doc.data().statuses ?? {}).length) changes.push({ ref: doc.ref, value: { statuses: {} }, create: false, replaceStatuses: true });
console.log(`${errors.length} lỗi dữ liệu; ${changes.length} tài liệu cần cập nhật.`);
for (const error of errors.slice(0, 30)) console.error(error);
if (errors.length) { process.exitCode = 1; }
else if (mode === "check") { process.exitCode = changes.length ? 1 : 0; }
else if (changes.length) {
  const backupDir = `.migration-backups/vocab-${projectId}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  await mkdir(backupDir, { recursive: true });
  for (const name of names) await writeFile(`${backupDir}/${name}.json`, JSON.stringify(snapshots[name].map(doc => ({ id: doc.id, data: doc.data() })), null, 2));
  console.log(`Đã sao lưu vào ${backupDir}`);
  for (let i = 0; i < changes.length; i += 400) {
    const batch = store.batch();
    for (const change of changes.slice(i, i + 400)) change.create ? batch.create(change.ref, change.value) : change.replaceStatuses ? batch.update(change.ref, change.value) : batch.set(change.ref, change.value);
    await batch.commit();
  }
  console.log(`Đã cập nhật ${changes.length} tài liệu.`);
}
