"use client";

import { useContext, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { EmptyState, ErrorState, Loading, PageTitle } from "@/components/ui";
import { HomeData } from "@/lib/client-types";
import { Pagination, usePagination } from "@/components/pagination";
import { useLoad, ViewerUid, invalidateLoadCache } from "@/lib/use-load";
import { api } from "@/lib/api-client";

export default function Grammar() {
  const router = useRouter();
  const uid = useContext(ViewerUid);
  const pagination = usePagination();
  const [kind, setKind] = useState<"theory" | "practice">("theory");
  const [busy, setBusy] = useState("");
  const [startError, setStartError] = useState("");
  useEffect(() => { if (new URLSearchParams(window.location.search).get("tab") === "practice") setKind("practice"); }, []);
  const { data, error, loading, reload } = useLoad<{items:HomeData["lessons"];nextPageToken:string|null}>(`/api/catalog?kind=lessons&grammarKind=${kind}&pageToken=${pagination.token}`, true);
  function select(next: "theory" | "practice") {
    setKind(next); pagination.reset(); setStartError("");
    window.history.replaceState(null, "", next === "practice" ? "/learn/grammar?tab=practice" : "/learn/grammar");
  }
  async function start(id: string) {
    setBusy(id); setStartError("");
    try {
      const result = await api<{id:string}>(`/api/lessons/${id}/attempts`, { method: "POST", body: JSON.stringify({ exerciseId: `default_${id}` }) });
      invalidateLoadCache(uid, ["/api/home", "/api/catalog?kind=lessons", "/api/history?"]);
      router.push(`/learn/quiz/${result.id}`);
    } catch (cause) { setStartError(cause instanceof Error ? cause.message : "Không bắt đầu được bài."); setBusy(""); }
  }
  return <><PageTitle title="Góc ngữ pháp" description="Chọn cách học hợp với ní hôm nay."/>
    <div className="filter-row"><button className={kind === "theory" ? "active" : ""} onClick={() => select("theory")}>Lý thuyết + bài tập</button><button className={kind === "practice" ? "active" : ""} onClick={() => select("practice")}>Bài tập</button></div>
    {loading ? <Loading/> : error || !data ? <ErrorState message={error} retry={reload}/> : <>
      {data.items.length ? <div className="lesson-list">{data.items.map((lesson, index) => <div className="lesson-row" key={lesson.id}>
        <span className="lesson-number">{String((pagination.page-1)*20+index+1).padStart(2,"0")}</span><span><h3>{lesson.title}</h3><p>{lesson.total ? `${lesson.total} câu hỏi · ${lesson.lastAttempt ? lesson.lastAttempt.status === "complete" ? `Lần gần nhất: ${lesson.lastAttempt.correct}/${lesson.lastAttempt.total}` : "Đang làm dở" : "Chưa học"}` : "Chưa có câu hỏi"}</p></span>
        {kind === "theory" ? <Link href={`/learn/grammar/${lesson.id}`} className="button button-primary button-small">Xem bài <ArrowRight size={17}/></Link> : <button className="button button-primary button-small" disabled={Boolean(busy) || !lesson.total} onClick={() => start(lesson.id)}>{busy === lesson.id ? "Đang chuẩn bị..." : "Bắt đầu"}<ArrowRight size={17}/></button>}
      </div>)}</div> : <EmptyState title={kind === "theory" ? "Chưa có bài lý thuyết" : "Chưa có bài tập"} detail="Khi admin thêm nội dung, ní sẽ thấy bài ở đây."/>}
      <Pagination page={pagination.page} nextPageToken={data.nextPageToken} previous={pagination.previous} next={pagination.next}/>
      {startError && <p className="form-error" role="alert">{startError}</p>}
    </>}
  </>;
}
