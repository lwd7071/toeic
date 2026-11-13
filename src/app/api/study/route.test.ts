import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/errors";

const { requireViewer, getUser, learnedDays } = vi.hoisted(() => ({ requireViewer: vi.fn(), getUser: vi.fn(), learnedDays: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireViewer, ApiError }));
vi.mock("@/lib/firebase-admin", () => ({ adminAuth: () => ({ getUser }) }));
vi.mock("@/lib/study-store", () => ({ learnedDays }));

import { GET } from "./route";

describe("learner study calendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireViewer.mockResolvedValue({ uid: "learner-1" });
    getUser.mockResolvedValue({ metadata: { creationTime: "2026-11-01T00:00:00Z" } });
    learnedDays.mockResolvedValue(["2026-11-13", "2026-11-14"]);
  });

  it("reads only the signed-in learner's activity", async () => {
    const response = await GET(new Request("http://localhost/api/study?month=2026-11"));
    expect(response.status).toBe(200);
    expect(learnedDays).toHaveBeenCalledWith("learner-1");
    expect((await response.json()).days).toEqual(["2026-11-13", "2026-11-14"]);
  });

  it("requires sign-in", async () => {
    requireViewer.mockRejectedValue(new ApiError(401, "Sign in"));
    const response = await GET(new Request("http://localhost/api/study"));
    expect(response.status).toBe(401);
    expect(learnedDays).not.toHaveBeenCalled();
  });
});
