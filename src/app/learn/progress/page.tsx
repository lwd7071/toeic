"use client";

import Link from "next/link";
import { ArrowRight, BookOpenText, Layers3 } from "lucide-react";
import { EmptyState, ErrorState, Loading, PageTitle } from "@/components/ui";
import { HomeData } from "@/lib/client-types";
import { useLoad } from "@/lib/use-load";

export default function Progress() {
  const {data,error,loading,reload}=useLoad<HomeData>("/api/home");
  if(loading)return <Loading/>;
  if(error||!data)return <ErrorState message={error} retry={reload}/>;
  const total=data.topics.reduce((n,t)=>n+t.total,0), remembered=data.topics.reduce((n,t)=>n+t.remembered,0), review=data.topics.reduce((n,t)=>n+t.toReview,0);
  return <><PageTitle title="Bước tiến của ní" description="Miu lưu lại mỗi lần ní học để mình tiếp tục từ đúng chỗ."/><div className="two-col"><div className="paper-panel"><Layers3 size={25}/><h2 className="spaced">Từ vựng</h2><p>Đã nhớ <strong>{remembered}/{total}</strong> thẻ · Cần ôn <strong>{review}</strong> thẻ</p><Link href="/learn/vocabulary" className="button button-mint">Ôn từ vựng <ArrowRight size={17}/></Link></div><div className="paper-panel"><BookOpenText size={25}/><h2 className="spaced">Ngữ pháp</h2><p>Đã hoàn thành <strong>{data.attempts.filter(a=>a.status==="complete").length}</strong> lượt luyện tập</p><Link href="/learn/grammar" className="button button-pink">Luyện tiếp <ArrowRight size={17}/></Link></div></div><div className="section-heading"><h2>Lịch sử làm bài</h2></div>{data.attempts.length?<div className="lesson-list">{data.attempts.map(a=>{const lesson=data.lessons.find(l=>l.id===a.lessonId);return <Link className="lesson-row" href={`/learn/quiz/${a.id}`} key={a.id}><span className="lesson-number"><BookOpenText size={21}/></span><span><h3>{lesson?.title??"Bài đã ẩn"}</h3><p>{a.status==="complete"?`${a.correct}/${a.total} câu đúng`:`Đang làm · ${a.answered}/${a.total} câu`} · {new Date(a.startedAt).toLocaleDateString("vi-VN")}</p></span><ArrowRight size={19}/></Link>})}</div>:<EmptyState title="Chưa có lượt làm bài" detail="Làm một bài ngữ pháp, lịch sử của ní sẽ xuất hiện ở đây."/>}</>;
}
