import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/errors";

const { requireAdmin, listUsers, studyDays } = vi.hoisted(() => ({ requireAdmin: vi.fn(), listUsers: vi.fn(), studyDays: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin, ApiError }));
vi.mock("@/lib/firebase-admin", () => ({ adminAuth: () => ({ listUsers }) }));
vi.mock("@/lib/study-store", () => ({ studyDays }));

import { GET } from "./route";

describe("admin study calendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockResolvedValue({ uid: "admin" });
    listUsers.mockResolvedValue({ users: [{ uid: "learner-1", email: "learner@example.com", displayName: "Learner", metadata: { creationTime: "2026-11-01T00:00:00Z" } }], pageToken: undefined });
    studyDays.mockResolvedValue({ days: [], streak: 0, studiedToday: false });
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

  it("excludes configured bot account from students list", async () => {
    const prevBot = process.env.BOT_FIREBASE_UID;
    process.env.BOT_FIREBASE_UID = "bot-uid-1";
    try {
      listUsers.mockResolvedValue({
        users: [
          { uid: "bot-uid-1", email: "bot@internal.local", displayName: "Bot", metadata: { creationTime: "2026-11-01T00:00:00Z" } },
          { uid: "learner-1", email: "learner@example.com", displayName: "Learner", metadata: { creationTime: "2026-11-01T00:00:00Z" } },
        ],
        pageToken: undefined,
      });
      const response = await GET(new Request("http://localhost/api/admin/study?month=2026-11"));
      const json = await response.json();
      expect(json.students.map((s: { uid: string }) => s.uid)).toEqual(["learner-1"]);
    } finally {
      if (prevBot === undefined) delete process.env.BOT_FIREBASE_UID;
      else process.env.BOT_FIREBASE_UID = prevBot;
    }
  });
});
