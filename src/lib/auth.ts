import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase-admin";
import { isConfiguredAdmin, isConfiguredBot } from "@/lib/auth-role";
import { ApiError } from "@/lib/errors";

export type Viewer = { uid: string; email: string; isAdmin: boolean; isBot: boolean };

export async function viewer(): Promise<Viewer | null> {
  const token = (await cookies()).get("miu_session")?.value;
  if (!token) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(token, true);
    const email = decoded.email?.toLowerCase() ?? "";
    return {
      uid: decoded.uid,
      email,
      isAdmin: isConfiguredAdmin(decoded, process.env.ADMIN_GOOGLE_EMAIL),
      isBot: isConfiguredBot(decoded, process.env.BOT_FIREBASE_UID),
    };
  } catch {
    return null;
  }
}

export async function requireViewer(): Promise<Viewer> {
  const user = await viewer();
  if (!user) throw new ApiError(401, "Vui lòng đăng nhập Google để tiếp tục.");
  if (user.isBot) throw new ApiError(403, "Tài khoản Bot chỉ được quản lý nội dung.");
  return user;
}

export async function requireAdmin(): Promise<Viewer> {
  const user = await requireViewer();
  if (!user.isAdmin) throw new ApiError(403, "Chỉ admin mới được quản lý nội dung.");
  return user;
}

export async function requireContentEditor(): Promise<Viewer> {
  const user = await viewer();
  if (!user) throw new ApiError(401, "Vui lòng đăng nhập để tiếp tục.");
  if (!user.isAdmin && !user.isBot) throw new ApiError(403, "Chỉ người quản lý nội dung mới được sửa bài học.");
  return user;
}

export { ApiError };
