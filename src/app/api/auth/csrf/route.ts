import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET() {
  const token = randomBytes(24).toString("hex");
  (await cookies()).set("miu_csrf", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 60 * 60 * 2 });
  return Response.json({ token });
}
