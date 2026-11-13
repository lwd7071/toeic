"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BookOpenText, Flame, Headphones, Layers3 } from "lucide-react";
import { EmptyState, ErrorState, Loading, PageTitle } from "@/components/ui";
import { Pagination, usePagination } from "@/components/pagination";
import { StudyCalendar, StudyCalendarData } from "@/components/study-calendar";
import { HomeData } from "@/lib/client-types";
import { vietnamDate } from "@/lib/study-days";
import { useLoad } from "@/lib/use-load";

type History = { items: { id: string; kind: "grammar" | "listening"; title: string; correct: number; total: number; answered: number; status: string; at: string }[]; nextPageToken: string | null; grammarCompleted: number; listeningCompleted: number };

export default function Progress() {
  const [month, setMonth] = useState(() => vietnamDate().slice(0, 7));
  const pagination = usePagination();
  const { data, error, loading, reload } = useLoad<HomeData>("/api/home");
  const history = useLoad<History>(`/api/history?pageToken=${pagination.token}`);
  const study = useLoad<StudyCalendarData>(`/api/study?month=${month}`);
  if (loading || history.loading || study.loading) return <Loading/>;
  if (error || !data) return <ErrorState message={error} retry={reload}/>;
  if (history.error || !history.data) return <ErrorState message={history.error} retry={history.reload}/>;
  if (study.error || !study.data) return <ErrorState message={study.error} retry={study.reload}/>;
  const total = data.topics.reduce((n, topic) => n + topic.total, 0);
  const remembered = data.topics.reduce((n, topic) => n + topic.remembered, 0);
  const review = data.topics.reduce((n, topic) => n + topic.toReview, 0);
  return <><PageTitle title="Bước tiến của ní" description="Miu lưu lại mỗi lần ní học để mình tiếp tục từ đúng chỗ."/>
    <div className="study-streak"><Flame size={28} fill="currentColor"/><strong>{study.data.streak} ngày liên tiếp</strong><span>{study.data.studiedToday ? "Hôm nay ní đã nhận 🔥" : "Hoàn thành một bài hoặc đánh dấu một thẻ để nhận 🔥 hôm nay"}</span></div>
    <StudyCalendar data={study.data} onMonthChange={setMonth}/>
    <div className="two-col spaced"><div className="paper-panel"><Layers3 size={25}/><h2 className="spaced">Từ vựng</h2><p>Đã nhớ <strong>{remembered}/{total}</strong> thẻ · Cần ôn <strong>{review}</strong> thẻ</p><Link href="/learn/vocabulary" className="button button-mint">Ôn từ vựng <ArrowRight size={17}/></Link></div><div className="paper-panel"><BookOpenText size={25}/><h2 className="spaced">Ngữ pháp</h2><p>Đã hoàn thành <strong>{history.data.grammarCompleted}</strong> lượt luyện tập</p><Link href="/learn/grammar" className="button button-pink">Luyện tiếp <ArrowRight size={17}/></Link></div><div className="paper-panel"><Headphones size={25}/><h2 className="spaced">Listening</h2><p>Đã hoàn thành <strong>{history.data.listeningCompleted}</strong> lượt luyện tập</p><Link href="/learn/listening" className="button button-mint">Luyện nghe <ArrowRight size={17}/></Link></div></div>
    <div className="section-heading"><h2>Lịch sử làm bài</h2></div>
    {history.data.items.length ? <div className="lesson-list">{history.data.items.map(item => <Link className="lesson-row" href={item.kind === "listening" ? `/learn/listening/result/${item.id}` : `/learn/quiz/${item.id}`} key={`${item.kind}-${item.id}`}><span className="lesson-number">{item.kind === "listening" ? <Headphones size={21}/> : <BookOpenText size={21}/>}</span><span><h3>{item.title}</h3><p>{item.kind === "listening" ? `Listening · ${item.correct}/${item.total} câu đúng` : item.status === "complete" ? `${item.correct}/${item.total} câu đúng` : `Đang làm · ${item.answered}/${item.total} câu`} · {new Date(item.at).toLocaleDateString("vi-VN")}</p></span><ArrowRight size={19}/></Link>)}</div> : <EmptyState title="Chưa có lượt làm bài" detail="Làm một bài ngữ pháp hoặc listening, lịch sử của ní sẽ xuất hiện ở đây."/>}
    <Pagination page={pagination.page} nextPageToken={history.data.nextPageToken} previous={pagination.previous} next={pagination.next}/>
  </>;
}
