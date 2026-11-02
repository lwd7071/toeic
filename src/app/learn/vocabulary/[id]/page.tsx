"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, RotateCcw, Volume2, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { useLoad } from "@/lib/use-load";
import { EmptyState, ErrorState, Loading, PageTitle } from "@/components/ui";

type Card = { id: string; english: string; vietnamese: string; status: "new"|"review"|"remembered" };
type Data = { topic: { id: string; title: string }; cards: Card[] };

export default function Flashcards() {
  const id = useParams<{id:string}>().id;
  const { data, error, loading, reload, setData } = useLoad<Data>(`/api/topics/${id}/cards`);
  const [filter, setFilter] = useState<"all"|"review">("all");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const cards = useMemo(() => data?.cards.filter(c => filter === "all" || c.status === "review") ?? [], [data,filter]);
  const current = cards[index % Math.max(cards.length,1)];
  async function mark(status: "review"|"remembered") {
    if (!current || !data) return;
    setSaving(true); setSaveError("");
    try {
      await api(`/api/cards/${current.id}/progress`, { method:"PATCH", body:JSON.stringify({status}) });
      setData({ ...data, cards:data.cards.map(c => c.id === current.id ? {...c,status} : c) });
      setFlipped(false); setIndex(filter === "review" ? index : index+1);
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
  if (loading) return <Loading/>;
  if (error || !data) return <ErrorState message={error} retry={reload}/>;
  return <><Link href="/learn/vocabulary" className="back-link"><ArrowLeft size={17}/> Tất cả chủ đề</Link><PageTitle title={data.topic.title} description={`${data.cards.length} thẻ · Học theo nhịp của ní`}/>
    <div className="filter-row"><button className={filter==="all"?"active":""} onClick={()=>{setFilter("all");setIndex(0);setFlipped(false)}}>Tất cả</button><button className={filter==="review"?"active":""} onClick={()=>{setFilter("review");setIndex(0);setFlipped(false)}}>Cần ôn ({data.cards.filter(c=>c.status==="review").length})</button></div>
    {current ? <div className="flashcard-stage"><div className="study-head"><span>Thẻ {index % cards.length + 1} / {cards.length}</span><button type="button" className="button button-small button-ghost" onClick={speak} disabled={speaking} aria-label={`Phát âm ${current.english}`}><Volume2 size={17}/> Nghe phát âm</button><span>{current.status === "remembered" ? "Đã nhớ" : current.status === "review" ? "Cần ôn" : "Chưa học"}</span></div><button type="button" className={`flashcard ${flipped?"flipped":""}`} onClick={()=>setFlipped(!flipped)} aria-label={flipped ? "Xem từ tiếng Anh" : "Lật thẻ xem nghĩa"}><span className="card-corner">{flipped ? "Nghĩa tiếng Việt" : "Từ tiếng Anh"}</span><span className="word">{flipped ? current.vietnamese : current.english}</span><span className="hint">Chạm để {flipped ? "xem từ" : "xem nghĩa"}</span></button><div className="card-actions"><button className="button button-pink" disabled={saving} onClick={()=>mark("review")}><X size={18}/> Chưa nhớ</button><button className="button button-ghost" onClick={()=>{setIndex(index+1);setFlipped(false)}}><RotateCcw size={17}/> Thẻ tiếp</button><button className="button button-mint" disabled={saving} onClick={()=>mark("remembered")}><Check size={18}/> Đã nhớ</button></div>{saveError && <p className="form-error" role="alert">{saveError}</p>}</div> : <EmptyState title={filter==="review"?"Miu hết thẻ cần ôn rồi!":"Chủ đề này chưa có thẻ"} detail={filter==="review"?"Quay lại tất cả thẻ để học thêm nhé.":"Admin sẽ thêm từ vào chủ đề này sớm thôi."} action={filter==="review"?<button className="button" onClick={()=>setFilter("all")}>Xem tất cả thẻ</button>:undefined}/>}
  </>;
}
