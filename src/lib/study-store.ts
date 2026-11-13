import { db } from "@/lib/firebase-admin";
import { trackingStartDate, vietnamDate } from "@/lib/study-days";

export function studyDayRef(uid: string, date: string) {
  return db().collection("studyDays").doc(uid).collection("days").doc(date);
}

export function qualifiedDay(at: Date = new Date()): { date: string; at: string } | null {
  const date = vietnamDate(at);
  return date >= trackingStartDate() ? { date, at: at.toISOString() } : null;
}

export async function learnedDays(uid: string): Promise<string[]> {
  const snap = await db().collection("studyDays").doc(uid).collection("days").get();
  const start = trackingStartDate();
  return snap.docs.map(doc => doc.id).filter(day => day >= start);
}
