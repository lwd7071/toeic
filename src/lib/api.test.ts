import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./errors";

const { headerMap, cookieMap } = vi.hoisted(() => ({
  headerMap: new Map<string, string>(),
  cookieMap: new Map<string, string>(),
}));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (key: string) => headerMap.get(key) ?? null }),
  cookies: async () => ({ get: (key: string) => (cookieMap.has(key) ? { value: cookieMap.get(key) } : undefined) }),
}));

import { requireCsrf } from "./api";

describe("requireCsrf", () => {
  beforeEach(() => {
    headerMap.clear();
    cookieMap.clear();
  });

  it("throws 403 ApiError instead of TypeError when Origin is malformed or null", async () => {
    cookieMap.set("miu_csrf", "token-1");
    headerMap.set("x-csrf-token", "token-1");
    headerMap.set("origin", "null");
    headerMap.set("host", "localhost:3000");

    await expect(requireCsrf()).rejects.toMatchObject({ status: 403 });
    await expect(requireCsrf()).rejects.toBeInstanceOf(ApiError);
  });
});
