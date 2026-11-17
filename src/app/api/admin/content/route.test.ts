import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/errors";

const { requireContentEditor, requireCsrf, db, firestorePage, revalidateTag, add, queried, creates } = vi.hoisted(() => ({
  requireContentEditor: vi.fn(), requireCsrf: vi.fn(), db: vi.fn(), firestorePage: vi.fn(), revalidateTag: vi.fn(), add: vi.fn(), queried: [] as string[], creates: [] as { path: string; value: Record<string, unknown> }[],
}));
vi.mock("@/lib/auth", () => ({ requireContentEditor, ApiError }));
vi.mock("@/lib/api", () => ({ requireCsrf, textField: (value: string) => value.trim(), jsonError: (error: Error) => Response.json({ error: error.message }, { status: 500 }) }));
vi.mock("@/lib/firebase-admin", () => ({ db }));
vi.mock("@/lib/pagination", () => ({ firestorePage }));
vi.mock("next/cache", () => ({ revalidateTag }));

import { GET, POST } from "./route";

describe("admin content pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks(); queried.length = 0; creates.length = 0;
    requireContentEditor.mockResolvedValue({ isBot: false });
    add.mockResolvedValue({ id: "new-topic" });
    db.mockReturnValue({ collection: (name: string) => {
      queried.push(name);
      return { name, where() { return this; }, doc: (id = "new-topic") => ({ id, path: `${name}/${id}` }), add };
    }, batch: () => ({ create: (ref: { path: string }, value: Record<string, unknown>) => creates.push({ path: ref.path, value }), commit: async () => {} }) });
    firestorePage.mockImplementation(async (query: { name: string }) => query.name === "vocabTopics" ? {
      docs: [{ id: "topic", exists: true, data: () => ({ title: "Topic", totalCount: 300 }) }], nextPageToken: "topic",
    } : {
      docs: [{ id: "card", data: () => ({ english: "word" }) }], nextPageToken: "card",
    });
  });

  it("requests only the parent and selected child pages", async () => {
    const response = await GET(new Request("http://localhost/api/admin/content?tab=cards"));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.parents).toHaveLength(1);
    expect(data.children).toHaveLength(1);
    expect(data.parentNextToken).toBe("topic");
    expect(data.childNextToken).toBe("card");
    expect(firestorePage).toHaveBeenCalledTimes(2);
    expect(queried).toEqual(["vocabTopics", "vocabCards"]);
  });

  it("loads only the requested admin section", async () => {
    const parents = await GET(new Request("http://localhost/api/admin/content?section=parents&tab=cards"));
    expect((await parents.json()).parents).toHaveLength(1);
    expect(queried).toEqual(["vocabTopics"]);
    queried.length = 0;
    firestorePage.mockClear();
    const items = await GET(new Request("http://localhost/api/admin/content?section=items&tab=cards&selected=topic"));
    expect((await items.json()).children).toHaveLength(1);
    expect(queried).toEqual(["vocabCards"]);
    expect(firestorePage).toHaveBeenCalledTimes(1);
  });

  it("initializes counters and invalidates shared content after creation", async () => {
    const response = await POST(new Request("http://localhost/api/admin/content", { method: "POST", body: JSON.stringify({ kind: "topic", title: " CÔNG SỞ " }) }));
    expect(response.status).toBe(200);
    expect(creates).toContainEqual({ path: "vocabTopics/new-topic", value: expect.objectContaining({ title: "CÔNG SỞ", searchTitle: "công sở", totalCount: 0, activeCount: 0 }) });
    expect(creates).toContainEqual({ path: "vocabDecks/new-topic", value: { title: "CÔNG SỞ", archivedAt: null, cards: [] } });
    expect(revalidateTag).toHaveBeenCalledWith("content:topics");
  });

  it("creates a standalone practice lesson with one named exercise", async () => {
    const response = await POST(new Request("http://localhost/api/admin/content", { method: "POST", body: JSON.stringify({ kind: "lesson", lessonKind: "practice", title: "Luyện thì" }) }));
    expect(response.status).toBe(200);
    expect(creates).toContainEqual({ path: "grammarLessons/new-topic", value: expect.objectContaining({ kind: "practice", title: "Luyện thì", theory: "" }) });
    expect(creates).toContainEqual({ path: "grammarExercises/default_new-topic", value: expect.objectContaining({ title: "Luyện thì" }) });
  });
});
