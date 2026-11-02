import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Miu TOEIC", description: "Học từ vựng và ngữ pháp TOEIC cùng Miu." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
