"use client";

import Link from "next/link";
import { ArrowRight, Headphones } from "lucide-react";
import { EmptyState, ErrorState, Loading, PageTitle } from "@/components/ui";
import { useLoad } from "@/lib/use-load";
import { Pagination, usePagination } from "@/components/pagination";

type Data = { sets: { id: string; title: string; kind: "dictation" | "picture"; total: number }[]; attempts: { id: string; setId: string; correct: number; total: number }[] };
export default function Listening() {
  const pagination = usePagination();
  const { data, error, loading, reload } = useLoad<{items:(Data["sets"][number] & {lastAttempt:{correct:number;total:number}|null})[];nextPageToken:string|null}>(`/api/catalog?kind=listening&pageToken=${pagination.token}`);
  if (loading) return <Loading/>;
  if (error || !data) return <ErrorState message={error} retry={reload}/>;
  return <><PageTitle title="Góc listening" description="Nghe chép câu ngắn và luyện mô tả tranh cùng Miu."/>
    {data.items.length ? <div className="lesson-list">{data.items.map((set, index) => {
      const last = set.lastAttempt;
      return <Link className="lesson-row" href={`/learn/listening/${set.id}`} key={set.id}><span className="lesson-number"><Headphones size={22}/></span><span><h3>{set.title}</h3><p>{set.kind === "dictation" ? "Nghe chép" : "Mô tả tranh"} · {set.total} câu{last ? ` · Lần gần nhất ${last.correct}/${last.total}` : " · Chưa học"}</p></span><ArrowRight size={19}/></Link>;
    })}</div> : <EmptyState title="Chưa có bài listening" detail="Khi admin nhập đề, bài sẽ xuất hiện ở đây."/>}
    <Pagination page={pagination.page} nextPageToken={data.nextPageToken} previous={pagination.previous} next={pagination.next}/>
  </>;
}
