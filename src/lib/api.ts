import { cookies, headers } from "next/headers";
import { ApiError } from "@/lib/auth";

export function jsonError(error: unknown) {
  if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
  console.error(error);
  return Response.json({ error: "Có lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
}

export async function requireCsrf() {
  const h = await headers();
  const cookie = (await cookies()).get("miu_csrf")?.value;
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!cookie || h.get("x-csrf-token") !== cookie || !origin || new URL(origin).host !== host) {
    throw new ApiError(403, "Phiên bảo mật không hợp lệ. Hãy tải lại trang.");
  }
}

export function textField(value: unknown, name: string, max = 400): string {
  if (typeof value !== "string") throw new ApiError(400, `${name} không hợp lệ.`);
  const text = value.trim().normalize("NFC");
  if (!text || text.length > max) throw new ApiError(400, `${name} phải có từ 1 đến ${max} ký tự.`);
  return text;
}

export function nullableArchive(value: unknown): string | null {
  if (value === true) return new Date().toISOString();
  if (value === false) return null;
  throw new ApiError(400, "Trạng thái ẩn không hợp lệ.");
}
