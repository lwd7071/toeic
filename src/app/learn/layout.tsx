import { redirect } from "next/navigation";
import { viewer } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";
export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const user = await viewer();
  if (!user) redirect("/");
  return <AppShell isAdmin={user.isAdmin} email={user.email}>{children}</AppShell>;
}
