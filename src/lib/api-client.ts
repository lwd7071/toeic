let cachedCsrf: string | null = null;
let csrfInFlight: Promise<string> | null = null;

// Lấy CSRF token từ cache memory, chỉ gọi API khi chưa có hoặc cần làm mới
async function getCsrfToken(force = false): Promise<string> {
  if (cachedCsrf && !force) return cachedCsrf;
  if (!csrfInFlight || force) {
    csrfInFlight = fetch("/api/auth/csrf", { cache: "no-store" })
      .then(async res => {
        if (!res.ok) throw new Error("Không tạo được phiên bảo mật. Hãy tải lại trang.");
        const { token } = await res.json();
        cachedCsrf = token as string;
        return cachedCsrf;
      })
      .finally(() => { csrfInFlight = null; });
  }
  return csrfInFlight;
}

export function clearCsrfCache() {
  cachedCsrf = null;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isMutation = Boolean(init.method && init.method !== "GET");
  const execute = async (forceCsrf = false) => {
    const headers = new Headers(init.headers);
    if (init.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
    if (isMutation) headers.set("x-csrf-token", await getCsrfToken(forceCsrf));
    return fetch(path, { ...init, headers, cache: "no-store" });
  };

  let response = await execute(false);
  // Tự động làm mới CSRF token nếu hết hạn (403)
  if (isMutation && response.status === 403) {
    response = await execute(true);
  }
  if (path === "/api/auth/session" && init.method === "DELETE") clearCsrfCache();
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Không tải được dữ liệu. Hãy thử lại.");
  return data as T;
}
