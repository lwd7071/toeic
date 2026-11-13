import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/errors";

const { requireViewer, requireCsrf, db, documents } = vi.hoisted(() => ({
  requireViewer: vi.fn(), requireCsrf: vi.fn(), db: vi.fn(), documents: new Map<string, unknown>(),
}));
vi.mock("@/lib/auth", () => ({ requireViewer, ApiError }));
vi.mock("@/lib/api", () => ({ requireCsrf, jsonError: (error: ApiError) => Response.json({ error: error.message }, { status: error.status }) }));
vi.mock("@/lib/firebase-admin", () => ({ db }));

import { POST } from "./route";

describe("check one dictation answer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    documents.clear();
    requireViewer.mockResolvedValue({ uid: "student" });
    requireCsrf.mockResolvedValue(undefined);
    documents.set("listeningSets/set", { kind: "dictation", archivedAt: null });
    documents.set("listeningItems/item", { setId: "set", transcript: "Hello, world!", archivedAt: null });
    db.mockReturnValue({ collection: (name: string) => ({
      doc: (id: string) => ({ get: async () => ({ data: () => documents.get(`${name}/${id}`) }) }),
    }) });
  });

  const check = (selected: string, itemId = "item") => POST(new Request("http://localhost", {
    method: "POST", body: JSON.stringify({ itemId, selected }),
  }), { params: Promise.resolve({ id: "set" }) });

  it("uses the existing transcript comparison and returns feedback", async () => {
    expect(await (await check("  HELLO world ")).json()).toEqual({ correct: true, expected: "Hello, world!" });
    expect(await (await check("Hello word")).json()).toEqual({ correct: false, expected: "Hello, world!" });
  });

  it("rejects an empty answer", async () => {
    expect((await check("  ")).status).toBe(400);
    expect((await check("Hello world", "")).status).toBe(400);
  });

  it("reports authentication failure before reading the question", async () => {
    requireViewer.mockRejectedValue(new ApiError(401, "Vui lòng đăng nhập."));
    expect((await check("Hello world")).status).toBe(401);
    expect(db).not.toHaveBeenCalled();
  });

  it("rejects a foreign or archived question and a picture set", async () => {
    documents.set("listeningItems/item", { setId: "another", transcript: "Hello, world!", archivedAt: null });
    expect((await check("Hello world")).status).toBe(404);
    documents.set("listeningItems/item", { setId: "set", transcript: "Hello, world!", archivedAt: "2026-01-01" });
    expect((await check("Hello world")).status).toBe(404);
    documents.set("listeningSets/set", { kind: "picture", archivedAt: null });
    expect((await check("Hello world")).status).toBe(404);
  });
});
