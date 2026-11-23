"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, RotateCcw, Volume2, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { useLoad } from "@/lib/use-load";
import { ViewerUid, invalidateLoadCache } from "@/lib/use-load";
import { EmptyState, ErrorState, Loading, PageTitle } from "@/components/ui";

type Card = { id: string; english: string; vietnamese: string; status: "new"|"review"|"remembered" };
type Data = { topic: { id: string; title: string }; cards: Card[] };

export default function Flashcards() {
  const id = useParams<{id:string}>().id;
  const uid = useContext(ViewerUid);
  const { data, error, loading, reload, setData } = useLoad<Data>(`/api/topics/${id}/cards`, true);
  const [filter, setFilter] = useState<"all"|"review">("all");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const cards = useMemo(() => data?.cards.filter(c => filter === "all" || c.status === "review") ?? [], [data,filter]);
  const current = cards[index % Math.max(cards.length,1)];
  function next() { setIndex(index+1); setFlipped(false); }
  async function mark(status: "review"|"remembered") {
    if (saving || !current || !data) return;
    setSaving(true); setSaveError("");
    try {
      await api(`/api/cards/${current.id}/progress`, { method:"PATCH", body:JSON.stringify({status}) });
      invalidateLoadCache(uid, ["/api/home", "/api/catalog?kind=topics", "/api/progress-summary", "/api/study?"]);
      setData({ ...data, cards:data.cards.map(c => c.id === current.id ? {...c,status} : c) });
      // Ở tab "Cần ôn", chỉ giữ nguyên index khi thẻ bị loại khỏi danh sách (đánh dấu đã nhớ)
      setFlipped(false); setIndex(filter === "review" && status === "remembered" ? index : index + 1);
    } catch (cause) { setSaveError(cause instanceof Error ? cause.message : "Không lưu được thẻ."); }
    finally { setSaving(false); }
  }
  function speak() {
    if (!current || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(current.english);
    utterance.lang = "en-US";
    utterance.onend = utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!current || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [contenteditable]"))) return;
      if ((event.key === " " || event.key === "Enter") && target instanceof HTMLElement && target.closest("button:not(.flashcard), a, [role='button']")) return;
      if (event.key === "ArrowRight") { event.preventDefault(); next(); }
      else if (event.key === " ") { event.preventDefault(); if (!event.repeat) setFlipped(value => !value); }
      else if (event.key.toLowerCase() === "r") { event.preventDefault(); if (!event.repeat && !speaking) speak(); }
      else if (event.key === "Enter") { event.preventDefault(); if (!event.repeat && !saving) void mark("remembered"); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
  if (loading) return <Loading/>;
  if (error || !data) return <ErrorState message={error} retry={reload}/>;
  return <><Link href="/learn/vocabulary" className="back-link"><ArrowLeft size={17}/> Tất cả chủ đề</Link><PageTitle title={data.topic.title} description={`${data.cards.length} thẻ · Học theo nhịp của ní`}/>
    <div className="filter-row"><button className={filter==="all"?"active":""} onClick={()=>{setFilter("all");setIndex(0);setFlipped(false)}}>Tất cả</button><button className={filter==="review"?"active":""} onClick={()=>{setFilter("review");setIndex(0);setFlipped(false)}}>Cần ôn ({data.cards.filter(c=>c.status==="review").length})</button></div>
    {current ? <div className="flashcard-stage"><div className="study-head"><span>Thẻ {index % cards.length + 1} / {cards.length}</span><button type="button" className="button button-small button-ghost" onClick={speak} disabled={speaking} aria-label={`Phát âm ${current.english}`}><Volume2 size={17}/> Nghe phát âm</button><span>{current.status === "remembered" ? "Đã nhớ" : current.status === "review" ? "Cần ôn" : "Chưa học"}</span></div><button type="button" className={`flashcard ${flipped?"flipped":""}`} onClick={()=>setFlipped(!flipped)} aria-label={flipped ? "Xem từ tiếng Anh" : "Lật thẻ xem nghĩa"}><span className="card-corner">{flipped ? "Nghĩa tiếng Việt" : "Từ tiếng Anh"}</span><span className="word">{flipped ? current.vietnamese : current.english}</span><span className="hint">Chạm để {flipped ? "xem từ" : "xem nghĩa"}</span></button><div className="card-actions"><button className="button button-pink" disabled={saving} onClick={()=>mark("review")}><X size={18}/> Chưa nhớ</button><button className="button button-ghost" onClick={next}><RotateCcw size={17}/> Thẻ tiếp</button><button className="button button-mint" disabled={saving} onClick={()=>mark("remembered")}><Check size={18}/> Đã nhớ</button></div><p className="muted spaced">→ Thẻ tiếp · Space Lật thẻ · R Phát âm · Enter Đã nhớ</p>{saveError && <p className="form-error" role="alert">{saveError}</p>}</div> : <EmptyState title={filter==="review"?"Miu hết thẻ cần ôn rồi!":"Chủ đề này chưa có thẻ"} detail={filter==="review"?"Quay lại tất cả thẻ để học thêm nhé.":"Admin sẽ thêm từ vào chủ đề này sớm thôi."} action={filter==="review"?<button className="button" onClick={()=>setFilter("all")}>Xem tất cả thẻ</button>:undefined}/>}
  </>;
}
