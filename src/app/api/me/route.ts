import { viewer } from "@/lib/auth";
import { jsonError } from "@/lib/api";

export const runtime = "nodejs";
export async function GET() {
  try { return Response.json({ user: await viewer() }); }
  catch (error) { return jsonError(error); }
}
