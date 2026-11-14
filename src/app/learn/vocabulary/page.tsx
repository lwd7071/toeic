"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Layers3 } from "lucide-react";
import { EmptyState, ErrorState, Loading, PageTitle } from "@/components/ui";
import { HomeData } from "@/lib/client-types";
import { Pagination, usePagination } from "@/components/pagination";
import { useLoad } from "@/lib/use-load";

export default function Vocabulary() {
  const pagination = usePagination();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => { const timer = setTimeout(() => { pagination.reset(); setQuery(search); }, 250); return () => clearTimeout(timer); }, [search]);
  const { data, error, loading, reload } = useLoad<{items:HomeData["topics"];nextPageToken:string|null}>(`/api/catalog?kind=topics&search=${encodeURIComponent(query)}&pageToken=${pagination.token}`);
  if (loading) return <Loading/>;
  if (error || !data) return <ErrorState message={error} retry={reload}/>;
  const topics = data.items;
  return <><PageTitle title="Góc từ vựng" description="Chọn một chủ đề, lật thẻ và ôn lại những từ chưa nhớ." action={<input className="search-field" aria-label="Tìm từ đầu tên chủ đề" placeholder="Tìm từ đầu tên chủ đề..." value={search} onChange={e=>setSearch(e.target.value)}/>}/>
    {topics.length ? <div className="topic-grid">{topics.map(t => <Link key={t.id} href={`/learn/vocabulary/${t.id}`} className="topic-tile"><span className="tile-icon"><Layers3 size={20}/></span><h3>{t.title}</h3><p>{t.total} thẻ · Đã nhớ {t.remembered}</p><div className="progress-track"><span style={{width:`${t.total ? t.remembered / t.total * 100 : 0}%`}}/></div><ArrowRight className="tile-arrow" size={18}/></Link>)}</div> : <EmptyState title={search ? "Không thấy chủ đề này" : "Chưa có bộ từ nào"} detail={search ? "Thử tìm bằng một tên khác nhé." : "Khi admin thêm từ vựng, các bộ thẻ sẽ hiện ở đây."}/>}
    <Pagination page={pagination.page} nextPageToken={data.nextPageToken} previous={pagination.previous} next={pagination.next}/>
  </>;
}
