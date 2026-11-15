import { db } from "@/lib/firebase-admin";
import { trackingStartDate, vietnamDate } from "@/lib/study-days";
import { previousDate } from "@/lib/study-days";
import { FieldPath } from "firebase-admin/firestore";

export function studyDayRef(uid: string, date: string) {
  return db().collection("studyDays").doc(uid).collection("days").doc(date);
}

export function qualifiedDay(at: Date = new Date()): { date: string; at: string } | null {
  const date = vietnamDate(at);
  return date >= trackingStartDate() ? { date, at: at.toISOString() } : null;
}

export async function studyDays(uid: string, month: string, today: string) {
  const days = db().collection("studyDays").doc(uid).collection("days");
  const nextMonth = new Date(`${month}-01T00:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const end = nextMonth.toISOString().slice(0, 7);
  const monthly = await days.orderBy(FieldPath.documentId()).startAt(`${month}-01`).endBefore(`${end}-01`).get();
  const monthDays = monthly.docs.map(doc => doc.id).filter(day => day >= trackingStartDate());
  let expected = today, streak = 0, cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null, studiedToday = false;
  while (expected >= trackingStartDate()) {
    const query = days.orderBy(FieldPath.documentId(), "desc").startAt(today);
    const page = await (cursor ? query.startAfter(cursor) : query).limit(32).get();
    if (!page.docs.length) break;
    if (!cursor && page.docs[0].id !== today) expected = previousDate(today);
    studiedToday ||= page.docs.some(doc => doc.id === today);
    let gap = false;
    for (const doc of page.docs) {
      if (expected < trackingStartDate()) { gap = true; break; }
      if (doc.id !== expected) { gap = true; break; }
      streak++;
      expected = previousDate(expected);
    }
    if (gap || page.docs.length < 32) break;
    cursor = page.docs.at(-1)!;
  }
  return { days: monthDays, streak, studiedToday };
}
