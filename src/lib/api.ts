import { timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { ApiError } from "@/lib/auth";

export function jsonError(error: unknown) {
  if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
  // Trả 400 thay vì 500 khi client gửi JSON sai cú pháp
  if (error instanceof SyntaxError) return Response.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  console.error(error);
  return Response.json({ error: "Có lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function requireCsrf() {
  const h = await headers();
  const cookie = (await cookies()).get("miu_csrf")?.value;
  const headerToken = h.get("x-csrf-token");
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  // Tránh TypeError (500) khi Origin không phải URL hợp lệ (vd: "null")
  let originHost: string | null = null;
  if (origin) {
    try { originHost = new URL(origin).host; } catch { originHost = null; }
  }
  if (!cookie || !headerToken || !safeEqual(headerToken, cookie) || !originHost || originHost !== host) {
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
