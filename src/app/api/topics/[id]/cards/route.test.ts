import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, reads } = vi.hoisted(() => ({ db: vi.fn(), reads: [] as string[] }));
vi.mock("@/lib/auth", () => ({ requireViewer: async () => ({ uid: "learner" }), ApiError: class ApiError extends Error {} }));
vi.mock("@/lib/api", () => ({ jsonError: (error: Error) => Response.json({ error: error.message }, { status: 500 }) }));
vi.mock("@/lib/firebase-admin", () => ({ db }));
vi.mock("@/lib/cached-content", () => ({ cachedCards: async () => ({ topic: { id: "topic-1", archivedAt: null, title: "Topic" }, cards: [] }) }));

import { GET } from "./route";

describe("topic cards reads", () => {
  beforeEach(() => {
    reads.length = 0;
    db.mockReturnValue({ collection: (name: string) => ({
      doc: (id: string) => ({ get: async () => { reads.push(`${name}/${id}`); return { exists: false, data: () => undefined }; } }),
      name,
    }) });
  });

  it("loads progress for only the opened topic", async () => {
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "topic-1" }) });
    expect(response.status).toBe(200);
    expect(reads).toEqual(["topicProgress/learner_topic-1"]);
  });
});
