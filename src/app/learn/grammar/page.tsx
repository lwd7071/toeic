"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EmptyState, ErrorState, Loading, PageTitle } from "@/components/ui";
import { HomeData } from "@/lib/client-types";
import { useLoad } from "@/lib/use-load";

export default function Grammar() {
  const { data, error, loading, reload } = useLoad<HomeData>("/api/home");
  if (loading) return <Loading/>;
  if (error || !data) return <ErrorState message={error} retry={reload}/>;
  return <><PageTitle title="Góc ngữ pháp" description="Đọc một chút lý thuyết rồi luyện ngay với Miu."/>
    {data.lessons.length ? <div className="lesson-list">{data.lessons.map((l,i)=><Link key={l.id} href={`/learn/grammar/${l.id}`} className="lesson-row"><span className="lesson-number">{String(i+1).padStart(2,"0")}</span><span><h3>{l.title}</h3><p>{l.total} câu hỏi · {l.lastAttempt ? l.lastAttempt.status==="complete"?`Lần gần nhất: ${l.lastAttempt.correct}/${l.total}`:"Đang làm dở" : "Chưa học"}</p></span><ArrowRight size={19}/></Link>)}</div> : <EmptyState title="Chưa có bài ngữ pháp" detail="Khi admin tạo bài học, ní sẽ thấy bài ở đây."/>}
  </>;
}
