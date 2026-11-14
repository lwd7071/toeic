import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/errors";

const { db, writes } = vi.hoisted(() => ({ db: vi.fn(), writes: [] as { path: string; value: Record<string, unknown> }[] }));
vi.mock("@/lib/auth", () => ({ requireViewer: async () => ({ uid: "learner" }), ApiError }));
vi.mock("@/lib/api", () => ({ requireCsrf: async () => {}, jsonError: (error: Error) => Response.json({ error: error.message }, { status: 500 }) }));
vi.mock("@/lib/firebase-admin", () => ({ db }));
vi.mock("@/lib/study-store", () => ({ qualifiedDay: () => null, studyDayRef: vi.fn() }));
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { increment: (value: number) => ({ increment: value }) } }));

import { PATCH } from "./route";

describe("card progress summaries", () => {
  it("moves a card from review to remembered in topic and learner totals", async () => {
    writes.length = 0;
    const data: Record<string, Record<string, unknown>> = {
      "vocabCards/card": { topicId: "topic", archivedAt: null },
      "vocabTopics/topic": { archivedAt: null },
      "cardProgress/learner_card": { status: "review" },
    };
    db.mockReturnValue({
      collection: (name: string) => ({ doc: (id: string) => ({ path: `${name}/${id}` }) }),
      runTransaction: async (task: (tx: unknown) => Promise<unknown>) => task({
        get: async (ref: { path: string }) => ({ exists: Boolean(data[ref.path]), data: () => data[ref.path] }),
        set: (ref: { path: string }, value: Record<string, unknown>) => writes.push({ path: ref.path, value }),
      }),
    });
    const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ status: "remembered" }) }), { params: Promise.resolve({ id: "card" }) });
    expect(response.status).toBe(200);
    for (const path of ["topicProgress/learner_topic", "userProgress/learner"]) {
      expect(writes).toContainEqual({ path, value: expect.objectContaining({ review: { increment: -1 }, remembered: { increment: 1 } }) });
    }
  });
});
