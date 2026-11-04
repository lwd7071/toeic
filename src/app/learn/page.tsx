"use client";

import Link from "next/link";
import { ArrowRight, BookOpenText, Headphones, Layers3, Sparkles } from "lucide-react";
import { Mascot } from "@/components/mascot";
import { EmptyState, ErrorState, Loading } from "@/components/ui";
import { HomeData } from "@/lib/client-types";
import { useLoad } from "@/lib/use-load";

export default function LearnHome() {
  const { data, error, loading, reload } = useLoad<HomeData>("/api/home");
  if (loading) return <Loading/>;
  if (error || !data) return <ErrorState message={error} retry={reload}/>;
  const resume = data.attempts.find(a => a.status === "in_progress");
  const review = data.topics.reduce((sum, topic) => sum + topic.toReview, 0);
  return <>
    <section className="hero-panel"><div className="hero-copy"><span className="sticker sticker-yellow"><Sparkles size={15}/> Hôm nay học gì?</span><h1>Miu chờ ní vào học đó!</h1><p>{resume ? "Bài ngữ pháp đang làm vẫn ở đây. Mình tiếp tục nhé?" : review ? `Có ${review} thẻ đang chờ ôn lại. Học một chút cùng Miu nha!` : "Một chút từ vựng, một chút ngữ pháp. Bắt đầu từ điều ní thích nhé!"}</p><Link href={resume ? `/learn/quiz/${resume.id}` : data.topics.length ? "/learn/vocabulary" : "/learn/grammar"} className="button button-primary">{resume ? "Tiếp tục làm bài" : "Bắt đầu học"}<ArrowRight size={18}/></Link></div><Mascot size={330}/></section>
    <div className="section-heading"><h2>Bộ từ của ní</h2><Link href="/learn/vocabulary">Xem tất cả <ArrowRight size={15}/></Link></div>
    {data.topics.length ? <div className="topic-grid">{data.topics.slice(0,3).map(topic => <Link className="topic-tile" href={`/learn/vocabulary/${topic.id}`} key={topic.id}><span className="tile-icon"><Layers3 size={20}/></span><h3>{topic.title}</h3><p>{topic.total} thẻ · {topic.toReview} cần ôn</p><div className="progress-track"><span style={{width:`${topic.total ? topic.remembered / topic.total * 100 : 0}%`}}/></div><ArrowRight className="tile-arrow" size={18}/></Link>)}</div> : <EmptyState title="Chưa có bộ từ nào" detail="Miu sẽ để dành góc này cho bộ từ đầu tiên do admin thêm vào."/>}
    <div className="section-heading"><h2>Ngữ pháp để luyện</h2><Link href="/learn/grammar">Xem tất cả <ArrowRight size={15}/></Link></div>
    {data.lessons.length ? <div className="lesson-list">{data.lessons.slice(0,3).map((lesson,index) => <Link href={`/learn/grammar/${lesson.id}`} className="lesson-row" key={lesson.id}><span className="lesson-number">{String(index+1).padStart(2,"0")}</span><span><h3>{lesson.title}</h3><p>{lesson.total} câu hỏi {lesson.lastAttempt ? `· Đã làm ${lesson.lastAttempt.answered} câu` : "· Chưa bắt đầu"}</p></span><ArrowRight size={19}/></Link>)}</div> : <div className="paper-panel"><BookOpenText size={27}/><p className="spaced">Bài ngữ pháp sẽ xuất hiện ở đây khi admin thêm nội dung.</p></div>}
    <div className="section-heading"><h2>Luyện nghe cùng Miu</h2><Link href="/learn/listening">Xem tất cả <ArrowRight size={15}/></Link></div><Link className="lesson-row" href="/learn/listening"><span className="lesson-number"><Headphones size={22}/></span><span><h3>Nghe chép & mô tả tranh</h3><p>Chọn bài listening để luyện và lưu kết quả.</p></span><ArrowRight size={19}/></Link>
  </>;
}
