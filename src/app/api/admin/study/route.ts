import { requireAdmin, ApiError } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { adminAuth } from "@/lib/firebase-admin";
import { studyDays } from "@/lib/study-store";
import { trackingStartDate, validMonth, vietnamDate } from "@/lib/study-days";

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
    const page = await adminAuth().listUsers(20, pageToken);
    const adminEmail = process.env.ADMIN_GOOGLE_EMAIL?.trim().toLowerCase();
    const botUid = process.env.BOT_FIREBASE_UID?.trim();
    // Loại cả tài khoản admin và bot khỏi danh sách học viên
    const accounts = page.users.filter(account => account.email?.toLowerCase() !== adminEmail && (!botUid || account.uid !== botUid));
    const students = await Promise.all(accounts.map(async account => {
      const activity = await studyDays(account.uid, month, today);
      return {
        uid: account.uid,
        email: account.email ?? "",
        name: account.displayName ?? account.email ?? account.uid,
        startDate: [trackingStartDate(), vietnamDate(new Date(account.metadata.creationTime))].sort().at(-1)!,
        ...activity,
      };
    }));
    return Response.json({ today, month, students, nextPageToken: page.pageToken ?? null });
  } catch (error) { return jsonError(error); }
}
