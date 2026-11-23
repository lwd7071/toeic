import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/errors";

const { db, revalidateTag, updated } = vi.hoisted(() => ({
  db: vi.fn(),
  revalidateTag: vi.fn(),
  updated: [] as Record<string, unknown>[],
}));
vi.mock("@/lib/auth", () => ({ requireContentEditor: async () => ({ isBot: false }), ApiError }));
vi.mock("@/lib/api", () => ({
  requireCsrf: async () => {},
  nullableArchive: (v: boolean) => (v ? "archived" : null),
  textField: (v: unknown) => String(v).trim(),
  jsonError: (error: Error & { status?: number }) => Response.json({ error: error.message }, { status: error.status ?? 500 }),
}));
vi.mock("@/lib/firebase-admin", () => ({ db }));
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { increment: (v: number) => v } }));
vi.mock("next/cache", () => ({ revalidateTag }));

import { PATCH } from "./route";

describe("admin listening item patch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updated.length = 0;
    db.mockReturnValue({
      collection: (name: string) => ({
        doc: () => ({
          get: async () => name === "listeningItems"
            ? { exists: true, data: () => ({ setId: "s1", key: "\u0000https://drive.google.com/file/d/abcdefghij/view" }) }
            : { exists: true, data: () => ({ kind: "part2" }) },
          update: async (value: Record<string, unknown>) => { updated.push(value); },
        }),
      }),
    });
  });

  it("normalizes lowercase/whitespace correctAnswer when editing a part2 item", async () => {
    const res = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          audioUrl: "https://drive.google.com/file/d/abcdefghij/view",
          question: "Where is the meeting?",
          A: "At 9.",
          B: "In Room B.",
          C: "Yes.",
          correctAnswer: " b ",
          explanation: "Hỏi địa điểm.",
          translation: "Cuộc họp ở đâu?",
        }),
      }),
      { params: Promise.resolve({ kind: "item", id: "i1" }) },
    );
    expect(res.status).toBe(200);
    expect(updated[0]).toMatchObject({ correctAnswer: "B" });
  });
});
