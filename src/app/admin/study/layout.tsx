import { redirect } from "next/navigation";
import { viewer } from "@/lib/auth";

export default async function StudyAdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await viewer())?.isAdmin) redirect("/admin");
  return children;
}
