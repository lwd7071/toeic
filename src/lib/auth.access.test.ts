import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifySessionCookie } = vi.hoisted(() => ({ verifySessionCookie: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("@/lib/firebase-admin", () => ({ adminAuth: () => ({ verifySessionCookie }) }));

import { requireAdmin, requireContentEditor, requireViewer } from "./auth";

describe("Bot permissions", () => {
  beforeEach(() => {
    process.env.ADMIN_GOOGLE_EMAIL = "owner@example.com";
    process.env.BOT_FIREBASE_UID = "bot-uid";
    verifySessionCookie.mockReset();
  });

  it("lets the configured password account edit content but not access admin or learner data", async () => {
    verifySessionCookie.mockResolvedValue({ uid: "bot-uid", email: "bot@example.com", firebase: { sign_in_provider: "password" } });
    await expect(requireContentEditor()).resolves.toMatchObject({ isBot: true, isAdmin: false });
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
    await expect(requireViewer()).rejects.toMatchObject({ status: 403 });
  });

  it("denies the bot after its UID is removed from configuration", async () => {
    verifySessionCookie.mockResolvedValue({ uid: "bot-uid", email: "bot@example.com", firebase: { sign_in_provider: "password" } });
    delete process.env.BOT_FIREBASE_UID;
    await expect(requireContentEditor()).rejects.toMatchObject({ status: 403 });
  });
});
