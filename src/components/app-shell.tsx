"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpenText, ChartNoAxesColumn, Headphones, House, Layers3, LogOut, Settings2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { ViewerUid, clearLoadCache } from "@/lib/use-load";

const links = [
  { href: "/learn", label: "Trang đầu", icon: House },
  { href: "/learn/vocabulary", label: "Từ vựng", icon: Layers3 },
  { href: "/learn/grammar", label: "Ngữ pháp", icon: BookOpenText },
  { href: "/learn/listening", label: "Listening", icon: Headphones },
  { href: "/learn/progress", label: "Tiến độ", icon: ChartNoAxesColumn },
];

export function AppShell({ children, isAdmin, isBot = false, email, uid }: { children: React.ReactNode; isAdmin: boolean; isBot?: boolean; email: string; uid: string }) {
  const path = usePathname();
  const router = useRouter();
  async function logout() {
    try { await api("/api/auth/session", { method: "DELETE" }); }
    finally { clearLoadCache(uid); router.push(isBot ? "/bot/login" : "/"); router.refresh(); }
  }
  return <ViewerUid.Provider value={uid}><div className="app-wrap">
    <header className="site-header">
      <Link className="brand" href={isBot ? "/admin" : "/learn"}><span className="brand-mark">m</span><span>Miu<span className="brand-accent"> TOEIC</span></span></Link>
      <nav className="desktop-nav" aria-label="Điều hướng chính">
        {!isBot && links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={path === href || (href !== "/learn" && path.startsWith(href)) ? "nav-link active" : "nav-link"}><Icon size={18}/>{label}</Link>)}
      </nav>
      <div className="header-actions">
        {(isAdmin || isBot) && <Link href="/admin" className={path.startsWith("/admin") ? "admin-link active" : "admin-link"}><Settings2 size={18}/> <span>{isBot ? "Nội dung" : "Quản trị"}</span></Link>}
        <button type="button" className="icon-button" onClick={logout} title={`Đăng xuất ${email}`} aria-label="Đăng xuất"><LogOut size={19}/></button>
      </div>
    </header>
    <main id="main" className="main-content">{children}</main>
    {!isBot && <nav className="mobile-nav" aria-label="Điều hướng chính">
      {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={path === href || (href !== "/learn" && path.startsWith(href)) ? "mobile-link active" : "mobile-link"}><Icon size={21}/><span>{label}</span></Link>)}
    </nav>}
  </div></ViewerUid.Provider>;
}
