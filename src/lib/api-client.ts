export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
  if (init.method && init.method !== "GET") {
    const csrfResponse = await fetch("/api/auth/csrf", { cache: "no-store" });
    if (!csrfResponse.ok) throw new Error("Không tạo được phiên bảo mật. Hãy tải lại trang.");
    const { token } = await csrfResponse.json();
    headers.set("x-csrf-token", token);
  }
  const response = await fetch(path, { ...init, headers, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Không tải được dữ liệu. Hãy thử lại.");
  return data as T;
}
