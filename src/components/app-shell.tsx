"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpenText, ChartNoAxesColumn, House, Layers3, LogOut, Settings2 } from "lucide-react";
import { api } from "@/lib/api-client";

const links = [
  { href: "/learn", label: "Trang đầu", icon: House },
  { href: "/learn/vocabulary", label: "Từ vựng", icon: Layers3 },
  { href: "/learn/grammar", label: "Ngữ pháp", icon: BookOpenText },
  { href: "/learn/progress", label: "Tiến độ", icon: ChartNoAxesColumn },
];

export function AppShell({ children, isAdmin, email }: { children: React.ReactNode; isAdmin: boolean; email: string }) {
  const path = usePathname();
  const router = useRouter();
  async function logout() {
    try { await api("/api/auth/session", { method: "DELETE" }); }
    finally { router.push("/"); router.refresh(); }
  }
  return <div className="app-wrap">
    <header className="site-header">
      <Link className="brand" href="/learn"><span className="brand-mark">m</span><span>Miu<span className="brand-accent"> TOEIC</span></span></Link>
      <nav className="desktop-nav" aria-label="Điều hướng chính">
        {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={path === href || (href !== "/learn" && path.startsWith(href)) ? "nav-link active" : "nav-link"}><Icon size={18}/>{label}</Link>)}
      </nav>
      <div className="header-actions">
        {isAdmin && <Link href="/admin" className={path.startsWith("/admin") ? "admin-link active" : "admin-link"}><Settings2 size={18}/> <span>Quản trị</span></Link>}
        <button type="button" className="icon-button" onClick={logout} title={`Đăng xuất ${email}`} aria-label="Đăng xuất"><LogOut size={19}/></button>
      </div>
    </header>
    <main id="main" className="main-content">{children}</main>
    <nav className="mobile-nav" aria-label="Điều hướng chính">
      {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={path === href || (href !== "/learn" && path.startsWith(href)) ? "mobile-link active" : "mobile-link"}><Icon size={21}/><span>{label}</span></Link>)}
    </nav>
  </div>;
}
