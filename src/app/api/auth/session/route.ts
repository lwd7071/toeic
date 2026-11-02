import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase-admin";
import { ApiError } from "@/lib/auth";
import { jsonError, requireCsrf } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireCsrf();
    const { idToken } = await request.json();
    if (typeof idToken !== "string") throw new ApiError(400, "Thiếu thông tin đăng nhập.");
    const decoded = await adminAuth().verifyIdToken(idToken);
    if (Date.now() / 1000 - decoded.auth_time > 5 * 60) throw new ApiError(401, "Hãy đăng nhập Google lại.");
    const maxAge = 60 * 60 * 24 * 5;
    const session = await adminAuth().createSessionCookie(idToken, { expiresIn: maxAge * 1000 });
    (await cookies()).set("miu_session", session, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge });
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}

export async function DELETE() {
  try {
    await requireCsrf();
    (await cookies()).delete("miu_session");
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}
