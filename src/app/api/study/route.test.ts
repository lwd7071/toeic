import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/errors";

const { requireViewer, getUser, studyDays } = vi.hoisted(() => ({ requireViewer: vi.fn(), getUser: vi.fn(), studyDays: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireViewer, ApiError }));
vi.mock("@/lib/firebase-admin", () => ({ adminAuth: () => ({ getUser }) }));
vi.mock("@/lib/study-store", () => ({ studyDays }));

import { GET } from "./route";

describe("learner study calendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireViewer.mockResolvedValue({ uid: "learner-1" });
    getUser.mockResolvedValue({ metadata: { creationTime: "2026-11-01T00:00:00Z" } });
    studyDays.mockResolvedValue({ days: ["2026-11-13", "2026-11-14"], streak: 2, studiedToday: false });
  });

  it("reads only the signed-in learner's activity", async () => {
    const response = await GET(new Request("http://localhost/api/study?month=2026-11"));
    expect(response.status).toBe(200);
    expect(studyDays).toHaveBeenCalledWith("learner-1", "2026-11", expect.any(String));
    expect((await response.json()).days).toEqual(["2026-11-13", "2026-11-14"]);
  });

  it("requires sign-in", async () => {
    requireViewer.mockRejectedValue(new ApiError(401, "Sign in"));
    const response = await GET(new Request("http://localhost/api/study"));
    expect(response.status).toBe(401);
    expect(studyDays).not.toHaveBeenCalled();
  });
});
