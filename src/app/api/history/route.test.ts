import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/errors";

vi.mock("@/lib/auth", () => ({ requireViewer: async () => ({ uid: "user-1" }), ApiError }));
vi.mock("@/lib/firebase-admin", () => ({ db: vi.fn() }));

import { GET } from "./route";

describe("history pageToken validation", () => {
  it("rejects non-string timestamp cursor values with 400", async () => {
    const token = Buffer.from(JSON.stringify({ g: [2026, "abc"], l: null })).toString("base64url");
    const res = await GET(new Request(`http://localhost/api/history?pageToken=${token}`));
    expect(res.status).toBe(400);
  });
});
