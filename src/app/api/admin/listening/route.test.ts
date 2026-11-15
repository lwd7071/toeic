import { describe, expect, it, vi } from "vitest";

const { db, firestorePage } = vi.hoisted(() => ({ db: vi.fn(), firestorePage: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireContentEditor: async () => ({ isBot: false }) }));
vi.mock("@/lib/api", () => ({ jsonError: (error: Error) => Response.json({ error: error.message }, { status: 500 }) }));
vi.mock("@/lib/firebase-admin", () => ({ db }));
vi.mock("@/lib/pagination", () => ({ firestorePage }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
import { GET } from "./route";

describe("admin listening sections", () => {
  it("loads the sets page without reading items", async () => {
    const names: string[] = [];
    db.mockReturnValue({ collection: (name: string) => { names.push(name); return { name }; } });
    firestorePage.mockResolvedValue({ docs: [{ id: "set", data: () => ({ title: "Set" }) }], nextPageToken: null });
    const response = await GET(new Request("http://localhost/api/admin/listening?section=sets"));
    expect(response.status).toBe(200);
    expect(names).toEqual(["listeningSets"]);
    expect((await response.json()).sets).toHaveLength(1);
  });
});
