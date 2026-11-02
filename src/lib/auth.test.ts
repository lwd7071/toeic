import { describe, expect, it } from "vitest";
import { isConfiguredAdmin } from "./auth-role";

describe("admin identity", () => {
  const google = { email: "Owner@Gmail.com", email_verified: true, firebase: { sign_in_provider: "google.com" } };
  it("accepts only the configured verified Google identity", () => {
    expect(isConfiguredAdmin(google, " owner@gmail.com ")).toBe(true);
    expect(isConfiguredAdmin({ ...google, email_verified: false }, "owner@gmail.com")).toBe(false);
    expect(isConfiguredAdmin({ ...google, firebase: { sign_in_provider: "password" } }, "owner@gmail.com")).toBe(false);
    expect(isConfiguredAdmin(google, "someone@gmail.com")).toBe(false);
    expect(isConfiguredAdmin(google, "")).toBe(false);
  });
});
