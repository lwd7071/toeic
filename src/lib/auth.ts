import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase-admin";
import { isConfiguredAdmin } from "@/lib/auth-role";
import { ApiError } from "@/lib/errors";

export type Viewer = { uid: string; email: string; isAdmin: boolean };

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
    };
  } catch {
    return null;
  }
}

export async function requireViewer(): Promise<Viewer> {
  const user = await viewer();
  if (!user) throw new ApiError(401, "Vui lòng đăng nhập Google để tiếp tục.");
  return user;
}

export async function requireAdmin(): Promise<Viewer> {
  const user = await requireViewer();
  if (!user.isAdmin) throw new ApiError(403, "Chỉ admin mới được quản lý nội dung.");
  return user;
}

export { ApiError };
