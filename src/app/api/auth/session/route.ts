import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase-admin";
import { ApiError } from "@/lib/auth";
import { jsonError, requireCsrf } from "@/lib/api";
import { isConfiguredBot } from "@/lib/auth-role";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireCsrf();
    const { idToken, bot } = await request.json();
    if (typeof idToken !== "string") throw new ApiError(400, "Thiếu thông tin đăng nhập.");
    const decoded = await adminAuth().verifyIdToken(idToken);
    if (bot && !isConfiguredBot(decoded, process.env.BOT_FIREBASE_UID)) throw new ApiError(403, "Tài khoản này không có quyền Bot.");
    if (Date.now() / 1000 - decoded.auth_time > 5 * 60) throw new ApiError(401, "Hãy đăng nhập lại.");
    const maxAge = 60 * 60 * 24 * 5;
    const session = await adminAuth().createSessionCookie(idToken, { expiresIn: maxAge * 1000 });
    (await cookies()).set("miu_session", session, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge });
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}

export async function DELETE() {
  try {
    await requireCsrf();
    const jar = await cookies();
    const token = jar.get("miu_session")?.value;
    // Thu hồi refresh tokens phía server để vô hiệu hóa session cũ nếu bị lộ
    if (token) {
      try {
        const decoded = await adminAuth().verifySessionCookie(token, false);
        await adminAuth().revokeRefreshTokens(decoded.uid);
      } catch { /* Vẫn xóa cookie kể cả khi session đã hết hạn */ }
    }
    jar.delete("miu_session");
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}
