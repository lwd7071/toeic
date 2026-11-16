"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Headphones } from "lucide-react";
import { EmptyState, ErrorState, Loading, PageTitle } from "@/components/ui";
import { useLoad } from "@/lib/use-load";
import { Pagination, usePagination } from "@/components/pagination";

type Data = { sets: { id: string; title: string; kind: "dictation" | "picture"; total: number }[] };
export default function Listening() {
  const [kind, setKind] = useState<"dictation" | "picture">("dictation");
  const pagination = usePagination();
  const { data, error, loading, reload } = useLoad<{items:(Data["sets"][number] & {lastAttempt:{correct:number;total:number}|null})[];nextPageToken:string|null}>(`/api/catalog?kind=listening&listeningKind=${kind}&pageToken=${pagination.token}`, true);
  return <><PageTitle title="Góc listening" description="Chọn một dạng bài để luyện cùng Miu."/>
    <div className="filter-row listening-tabs" role="group" aria-label="Chọn dạng listening">
      <button type="button" className={kind === "dictation" ? "active" : ""} aria-pressed={kind === "dictation"} onClick={() => { if (kind !== "dictation") { setKind("dictation"); pagination.reset(); } }}>Nghe chép</button>
      <button type="button" className={kind === "picture" ? "active" : ""} aria-pressed={kind === "picture"} onClick={() => { if (kind !== "picture") { setKind("picture"); pagination.reset(); } }}>Mô tả tranh</button>
    </div>
    {loading ? <Loading/> : error || !data ? <ErrorState message={error} retry={reload}/> : <>
      {data.items.length ? <div className="lesson-list">{data.items.map(set => {
      const last = set.lastAttempt;
      return <Link className="lesson-row" href={`/learn/listening/${set.id}`} key={set.id}><span className="lesson-number"><Headphones size={22}/></span><span><h3>{set.title}</h3><p>{set.kind === "dictation" ? "Nghe chép" : "Mô tả tranh"} · {set.total} câu{last ? ` · Lần gần nhất ${last.correct}/${last.total}` : " · Chưa học"}</p></span><ArrowRight size={19}/></Link>;
    })}</div> : <EmptyState title={`Chưa có bài ${kind === "dictation" ? "nghe chép" : "mô tả tranh"}`} detail="Khi admin nhập đề, bài sẽ xuất hiện ở đây."/>}
      <Pagination page={pagination.page} nextPageToken={data.nextPageToken} previous={pagination.previous} next={pagination.next}/>
    </>}
  </>;
}
