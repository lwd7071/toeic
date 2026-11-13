import { requireAdmin, ApiError } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { adminAuth } from "@/lib/firebase-admin";
import { learnedDays } from "@/lib/study-store";
import { currentStreak, trackingStartDate, validMonth, vietnamDate } from "@/lib/study-days";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const today = vietnamDate();
    const params = new URL(request.url).searchParams;
    let month: string;
    try { month = validMonth(params.get("month"), today); }
    catch { throw new ApiError(400, "Tháng không hợp lệ."); }
    const pageToken = params.get("pageToken") ?? undefined;
    if (pageToken && pageToken.length > 2000) throw new ApiError(400, "Trang không hợp lệ.");
    const page = await adminAuth().listUsers(50, pageToken);
    const accounts = page.users.filter(account => account.email?.toLowerCase() !== process.env.ADMIN_GOOGLE_EMAIL?.trim().toLowerCase());
    const students = await Promise.all(accounts.map(async account => {
      const days = await learnedDays(account.uid);
      return {
        uid: account.uid,
        email: account.email ?? "",
        name: account.displayName ?? account.email ?? account.uid,
        startDate: [trackingStartDate(), vietnamDate(new Date(account.metadata.creationTime))].sort().at(-1)!,
        days: days.filter(day => day.startsWith(month)),
        streak: currentStreak(days, today),
        studiedToday: days.includes(today),
      };
    }));
    return Response.json({ today, month, students, nextPageToken: page.pageToken ?? null });
  } catch (error) { return jsonError(error); }
}
