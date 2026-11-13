import { requireViewer, ApiError } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { adminAuth } from "@/lib/firebase-admin";
import { learnedDays } from "@/lib/study-store";
import { currentStreak, trackingStartDate, validMonth, vietnamDate } from "@/lib/study-days";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const viewer = await requireViewer();
    const today = vietnamDate();
    let month: string;
    try { month = validMonth(new URL(request.url).searchParams.get("month"), today); }
    catch { throw new ApiError(400, "Tháng không hợp lệ."); }
    const [days, account] = await Promise.all([learnedDays(viewer.uid), adminAuth().getUser(viewer.uid)]);
    const startDate = [trackingStartDate(), vietnamDate(new Date(account.metadata.creationTime))].sort().at(-1)!;
    return Response.json({ today, startDate, month, days: days.filter(day => day.startsWith(month)), streak: currentStreak(days, today), studiedToday: days.includes(today) });
  } catch (error) { return jsonError(error); }
}
