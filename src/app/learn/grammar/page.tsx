"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EmptyState, ErrorState, Loading, PageTitle } from "@/components/ui";
import { HomeData } from "@/lib/client-types";
import { Pagination, usePagination } from "@/components/pagination";
import { useLoad } from "@/lib/use-load";

export default function Grammar() {
  const pagination = usePagination();
  const { data, error, loading, reload } = useLoad<{items:HomeData["lessons"];nextPageToken:string|null}>(`/api/catalog?kind=lessons&pageToken=${pagination.token}`);
  if (loading) return <Loading/>;
  if (error || !data) return <ErrorState message={error} retry={reload}/>;
  return <><PageTitle title="Góc ngữ pháp" description="Đọc một chút lý thuyết rồi luyện ngay với Miu."/>
    {data.items.length ? <div className="lesson-list">{data.items.map((l,i)=><Link key={l.id} href={`/learn/grammar/${l.id}`} className="lesson-row"><span className="lesson-number">{String((pagination.page-1)*20+i+1).padStart(2,"0")}</span><span><h3>{l.title}</h3><p>{l.total} câu hỏi · {l.lastAttempt ? l.lastAttempt.status==="complete"?`Lần gần nhất: ${l.lastAttempt.correct}/${l.lastAttempt.total}`:"Đang làm dở" : "Chưa học"}</p></span><ArrowRight size={19}/></Link>)}</div> : <EmptyState title="Chưa có bài ngữ pháp" detail="Khi admin tạo bài học, ní sẽ thấy bài ở đây."/>}
    <Pagination page={pagination.page} nextPageToken={data.nextPageToken} previous={pagination.previous} next={pagination.next}/>
  </>;
}
