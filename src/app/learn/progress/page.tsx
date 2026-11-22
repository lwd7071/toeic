"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpenText, Flame, Headphones, Layers3 } from "lucide-react";
import { EmptyState, ErrorState, Loading, PageTitle } from "@/components/ui";
import { Pagination, usePagination } from "@/components/pagination";
import { StudyCalendar, StudyCalendarData } from "@/components/study-calendar";
import { vietnamDate } from "@/lib/study-days";
import { useLoad } from "@/lib/use-load";

type History = { items: { id: string; kind: "grammar" | "listening"; title: string; correct: number; total: number; answered: number; status: string; at: string }[]; nextPageToken: string | null; grammarCompleted: number | null; listeningCompleted: number | null };

export default function Progress() {
  const [month, setMonth] = useState(() => vietnamDate().slice(0, 7));
  const [counts, setCounts] = useState({ grammar: 0, listening: 0 });
  const pagination = usePagination();
  const { data, error, loading, reload } = useLoad<{ total: number; remembered: number; review: number }>("/api/progress-summary", true);
  const history = useLoad<History>(`/api/history?pageToken=${pagination.token}`, true);
  const study = useLoad<StudyCalendarData>(`/api/study?month=${month}`, true);
  useEffect(() => { if (history.data?.grammarCompleted !== null && history.data?.grammarCompleted !== undefined) setCounts({ grammar: history.data.grammarCompleted, listening: history.data.listeningCompleted ?? 0 }); }, [history.data]);
  // Chỉ hiện loading toàn trang khi cả 3 API đều đang tải lần đầu
  if (loading && history.loading && study.loading) return <Loading/>;
  if (error) return <ErrorState message={error} retry={reload}/>;
  if (history.error) return <ErrorState message={history.error} retry={history.reload}/>;
  if (study.error) return <ErrorState message={study.error} retry={study.reload}/>;
  const total = data?.total ?? 0, remembered = data?.remembered ?? 0, review = data?.review ?? 0;
  return <><PageTitle title="Bước tiến của ní" description="Miu lưu lại mỗi lần ní học để mình tiếp tục từ đúng chỗ."/>
    {study.data ? <>
      <div className="study-streak"><Flame size={28} fill="currentColor"/><strong>{study.data.streak} ngày liên tiếp</strong><span>{study.data.studiedToday ? "Hôm nay ní đã nhận 🔥" : "Hoàn thành một bài hoặc đánh dấu một thẻ để nhận 🔥 hôm nay"}</span></div>
      <StudyCalendar data={study.data} onMonthChange={setMonth}/>
    </> : <Loading/>}
    <div className="two-col spaced"><div className="paper-panel"><Layers3 size={25}/><h2 className="spaced">Từ vựng</h2><p>Đã nhớ <strong>{remembered}/{total}</strong> thẻ · Cần ôn <strong>{review}</strong> thẻ</p><Link href="/learn/vocabulary" className="button button-mint">Ôn từ vựng <ArrowRight size={17}/></Link></div><div className="paper-panel"><BookOpenText size={25}/><h2 className="spaced">Ngữ pháp</h2><p>Đã hoàn thành <strong>{history.data?.grammarCompleted ?? counts.grammar}</strong> lượt luyện tập</p><Link href="/learn/grammar" className="button button-pink">Luyện tiếp <ArrowRight size={17}/></Link></div><div className="paper-panel"><Headphones size={25}/><h2 className="spaced">Listening</h2><p>Đã hoàn thành <strong>{history.data?.listeningCompleted ?? counts.listening}</strong> lượt luyện tập</p><Link href="/learn/listening" className="button button-mint">Luyện nghe <ArrowRight size={17}/></Link></div></div>
    <div className="section-heading"><h2>Lịch sử làm bài</h2></div>
    {history.loading || !history.data ? <Loading/> : <>
      {history.data.items.length ? <div className="lesson-list">{history.data.items.map(item => <Link className="lesson-row" href={item.kind === "listening" ? `/learn/listening/result/${item.id}` : `/learn/quiz/${item.id}`} key={`${item.kind}-${item.id}`}><span className="lesson-number">{item.kind === "listening" ? <Headphones size={21}/> : <BookOpenText size={21}/>}</span><span><h3>{item.title}</h3><p>{item.kind === "listening" ? `Listening · ${item.correct}/${item.total} câu đúng` : item.status === "complete" ? `${item.correct}/${item.total} câu đúng` : `Đang làm · ${item.answered}/${item.total} câu`} · {new Date(item.at).toLocaleDateString("vi-VN")}</p></span><ArrowRight size={19}/></Link>)}</div> : <EmptyState title="Chưa có lượt làm bài" detail="Làm một bài ngữ pháp hoặc listening, lịch sử của ní sẽ xuất hiện ở đây."/>}
      <Pagination page={pagination.page} nextPageToken={history.data.nextPageToken} previous={pagination.previous} next={pagination.next}/>
    </>}
  </>;
}
