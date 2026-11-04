"use client";

import Link from "next/link";
import { ArrowRight, Headphones } from "lucide-react";
import { EmptyState, ErrorState, Loading, PageTitle } from "@/components/ui";
import { useLoad } from "@/lib/use-load";

type Data = { sets: { id: string; title: string; kind: "dictation" | "picture"; total: number }[]; attempts: { id: string; setId: string; correct: number; total: number }[] };
export default function Listening() {
  const { data, error, loading, reload } = useLoad<Data>("/api/listening");
  if (loading) return <Loading/>;
  if (error || !data) return <ErrorState message={error} retry={reload}/>;
  return <><PageTitle title="Góc listening" description="Nghe chép câu ngắn và luyện mô tả tranh cùng Miu."/>
    {data.sets.length ? <div className="lesson-list">{data.sets.map((set, index) => {
      const last = data.attempts.find(a => a.setId === set.id);
      return <Link className="lesson-row" href={`/learn/listening/${set.id}`} key={set.id}><span className="lesson-number"><Headphones size={22}/></span><span><h3>{set.title}</h3><p>{set.kind === "dictation" ? "Nghe chép" : "Mô tả tranh"} · {set.total} câu{last ? ` · Lần gần nhất ${last.correct}/${last.total}` : " · Chưa học"}</p></span><ArrowRight size={19}/></Link>;
    })}</div> : <EmptyState title="Chưa có bài listening" detail="Khi admin nhập đề, bài sẽ xuất hiện ở đây."/>}
  </>;
}
