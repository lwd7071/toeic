import { requireViewer, ApiError } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { adminAuth } from "@/lib/firebase-admin";
import { studyDays } from "@/lib/study-store";
import { trackingStartDate, validMonth, vietnamDate } from "@/lib/study-days";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const viewer = await requireViewer();
    const today = vietnamDate();
    let month: string;
    try { month = validMonth(new URL(request.url).searchParams.get("month"), today); }
    catch { throw new ApiError(400, "Tháng không hợp lệ."); }
    const [activity, account] = await Promise.all([studyDays(viewer.uid, month, today), adminAuth().getUser(viewer.uid)]);
    const startDate = [trackingStartDate(), vietnamDate(new Date(account.metadata.creationTime))].sort().at(-1)!;
    return Response.json({ today, startDate, month, ...activity });
  } catch (error) { return jsonError(error); }
}
