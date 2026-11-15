import { requireViewer } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { cachedCardTotal } from "@/lib/cached-content";

export const runtime = "nodejs";
export async function GET() {
  try {
    const user = await requireViewer();
    const [total, progress] = await Promise.all([cachedCardTotal(), db().collection("userProgress").doc(user.uid).get()]);
    return Response.json({ total, remembered: progress.data()?.remembered ?? 0, review: progress.data()?.review ?? 0 });
  } catch (error) { return jsonError(error); }
}
