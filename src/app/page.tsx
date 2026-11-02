import Link from "next/link";
import { ArrowRight, BookOpenText, Layers3, Sparkles } from "lucide-react";
import { Mascot } from "@/components/mascot";
import { viewer } from "@/lib/auth";
import { SignInButton } from "@/components/sign-in-button";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const user = await viewer();
  return <div className="landing">
    <header className="landing-header"><div className="brand"><span className="brand-mark">m</span><span>Miu<span className="brand-accent"> TOEIC</span></span></div>{user ? <Link className="button button-small" href="/learn">Vào góc học <ArrowRight size={16}/></Link> : <SignInButton compact/>}</header>
    <main className="landing-main">
      <div className="landing-copy"><div className="sticker sticker-yellow"><Sparkles size={16}/> Góc học của ní</div><h1>Mỗi ngày một chút,<br/><em>TOEIC dễ thương</em> hơn.</h1><p>Học từ bằng flashcard, ôn ngữ pháp qua quiz và lưu lại những gì ní đã tiến bộ. Miu ngồi đây học cùng ní!</p><div className="landing-actions">{user ? <Link className="button button-primary" href="/learn">Học tiếp cùng Miu <ArrowRight size={18}/></Link> : <SignInButton/>}<span>Đăng nhập bằng Google để lưu tiến độ.</span></div></div>
      <div className="landing-art"><div className="art-sun"/><div className="art-note note-one"><Layers3 size={20}/> Từ vựng theo chủ đề</div><Mascot size={480}/><div className="art-note note-two"><BookOpenText size={20}/> Quiz ngữ pháp</div></div>
    </main>
    <div className="landing-bottom"><div><span className="mini-star">✦</span> Lật thẻ, nhớ từ</div><div><span className="mini-star">✦</span> Học lý thuyết gọn</div><div><span className="mini-star">✦</span> Biết đúng sai ngay</div></div>
  </div>;
}
