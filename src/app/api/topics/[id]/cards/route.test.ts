import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, filters } = vi.hoisted(() => ({ db: vi.fn(), filters: [] as [string, string, unknown][] }));
vi.mock("@/lib/auth", () => ({ requireViewer: async () => ({ uid: "learner" }), ApiError: class ApiError extends Error {} }));
vi.mock("@/lib/api", () => ({ jsonError: (error: Error) => Response.json({ error: error.message }, { status: 500 }) }));
vi.mock("@/lib/firebase-admin", () => ({ db }));

import { GET } from "./route";

describe("topic cards reads", () => {
  beforeEach(() => {
    filters.length = 0;
    db.mockReturnValue({ collection: (name: string) => ({
      doc: () => ({ get: async () => ({ exists: true, data: () => ({ archivedAt: null, title: "Topic" }) }) }),
      where(field: string, op: string, value: unknown) {
        filters.push([field, op, value]);
        return { where(nextField: string, nextOp: string, nextValue: unknown) {
          filters.push([nextField, nextOp, nextValue]); return this;
        }, get: async () => ({ docs: [] }) };
      },
      name,
    }) });
  });

  it("loads progress for only the opened topic", async () => {
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "topic-1" }) });
    expect(response.status).toBe(200);
    expect(filters).toContainEqual(["uid", "==", "learner"]);
    expect(filters).toContainEqual(["topicId", "==", "topic-1"]);
  });
});
