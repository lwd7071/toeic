"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Headphones } from "lucide-react";
import { EmptyState, ErrorState, Loading, PageTitle } from "@/components/ui";
import { useLoad } from "@/lib/use-load";
import { Pagination, usePagination } from "@/components/pagination";

type Kind = "dictation" | "picture" | "part2";
type Data = { sets: { id: string; title: string; kind: Kind; total: number }[] };
const KIND_LABELS: Record<Kind, string> = { dictation: "Nghe chép", picture: "Mô tả tranh", part2: "Hỏi - đáp (Part 2)" };
const EMPTY_LABELS: Record<Kind, string> = { dictation: "nghe chép", picture: "mô tả tranh", part2: "hỏi - đáp (Part 2)" };

export default function Listening() {
  const [kind, setKind] = useState<Kind>("dictation");
  const pagination = usePagination();
  const { data, error, loading, reload } = useLoad<{items:(Data["sets"][number] & {lastAttempt:{correct:number;total:number}|null})[];nextPageToken:string|null}>(`/api/catalog?kind=listening&listeningKind=${kind}&pageToken=${pagination.token}`, true);
  return <><PageTitle title="Góc listening" description="Chọn một dạng bài để luyện cùng Miu."/>
    <div className="filter-row listening-tabs" role="group" aria-label="Chọn dạng listening">
      {(["dictation", "picture", "part2"] as const).map(tab => (
        <button key={tab} type="button" className={kind === tab ? "active" : ""} aria-pressed={kind === tab} onClick={() => { if (kind !== tab) { setKind(tab); pagination.reset(); } }}>{KIND_LABELS[tab]}</button>
      ))}
    </div>
    {loading ? <Loading/> : error || !data ? <ErrorState message={error} retry={reload}/> : <>
      {data.items.length ? <div className="lesson-list">{data.items.map(set => {
      const last = set.lastAttempt;
      return <Link className="lesson-row" href={`/learn/listening/${set.id}`} key={set.id}><span className="lesson-number"><Headphones size={22}/></span><span><h3>{set.title}</h3><p>{KIND_LABELS[set.kind]} · {set.total} câu{last ? ` · Lần gần nhất ${last.correct}/${last.total}` : " · Chưa học"}</p></span><ArrowRight size={19}/></Link>;
    })}</div> : <EmptyState title={`Chưa có bài ${EMPTY_LABELS[kind]}`} detail="Khi admin nhập đề, bài sẽ xuất hiện ở đây."/>}
      <Pagination page={pagination.page} nextPageToken={data.nextPageToken} previous={pagination.previous} next={pagination.next}/>
    </>}
  </>;
}
