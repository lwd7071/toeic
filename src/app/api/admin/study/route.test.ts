import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/errors";

const { requireAdmin, listUsers, learnedDays } = vi.hoisted(() => ({ requireAdmin: vi.fn(), listUsers: vi.fn(), learnedDays: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin, ApiError }));
vi.mock("@/lib/firebase-admin", () => ({ adminAuth: () => ({ listUsers }) }));
vi.mock("@/lib/study-store", () => ({ learnedDays }));

import { GET } from "./route";

describe("admin study calendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockResolvedValue({ uid: "admin" });
    listUsers.mockResolvedValue({ users: [{ uid: "learner-1", email: "learner@example.com", displayName: "Learner", metadata: { creationTime: "2026-11-01T00:00:00Z" } }], pageToken: undefined });
    learnedDays.mockResolvedValue([]);
  });

  it("shows registered learners even with no completed study day", async () => {
    const response = await GET(new Request("http://localhost/api/admin/study?month=2026-11"));
    expect(response.status).toBe(200);
    expect((await response.json()).students).toMatchObject([{ uid: "learner-1", days: [], streak: 0, studiedToday: false }]);
  });

  it("rejects non-admin users before reading the roster", async () => {
    requireAdmin.mockRejectedValue(new ApiError(403, "Admin only"));
    const response = await GET(new Request("http://localhost/api/admin/study"));
    expect(response.status).toBe(403);
    expect(listUsers).not.toHaveBeenCalled();
  });
});
