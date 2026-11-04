"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api-client";
import { useLoad } from "@/lib/use-load";
import { ErrorState, Loading, PageTitle } from "@/components/ui";

type Item = { id: string; audioUrl: string; audioViewUrl: string; imageUrl?: string; imageViewUrl?: string };
type Data = { set: { id: string; title: string; kind: "dictation" | "picture" }; items: Item[] };
type Result = { id: string; correct: number; total: number; answers: { id: string; selected: string; correct: boolean; expected: string; A?: string; B?: string; C?: string; D?: string }[] };

function Media({ item }: { item: Item }) {
  return <div className="listening-media">
    {item.imageUrl && <><iframe className="drive-image" src={item.imageUrl} title="Tranh cần nghe mô tả" loading="lazy"/>{item.imageViewUrl && <a href={item.imageViewUrl} target="_blank" rel="noopener noreferrer">Mở ảnh trên Drive nếu khung không hiển thị</a>}</>}
    <div className="drive-audio-frame"><iframe className="drive-audio" src={item.audioUrl} title="Nghe audio câu hỏi" loading="lazy" allow="autoplay"/></div>
    <a href={item.audioViewUrl} target="_blank" rel="noopener noreferrer">Mở MP3 trên Drive</a>
  </div>;
}

export default function ListeningExercise() {
  const id = useParams<{ id: string }>().id;
  const { data, error, loading, reload } = useLoad<Data>(`/api/listening/${id}`);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false), [submitError, setSubmitError] = useState("");
  async function submit() {
    if (!data) return;
    setBusy(true); setSubmitError("");
    try { setResult(await api<Result>(`/api/listening/${id}/submit`, { method: "POST", body: JSON.stringify({ responses: data.items.map(item => ({ id: item.id, selected: responses[item.id] ?? "" })) }) })); window.scrollTo({ top: 0, behavior: "smooth" }); }
    catch (cause) { setSubmitError(cause instanceof Error ? cause.message : "Không nộp được bài."); }
    finally { setBusy(false); }
  }
  if (loading) return <Loading/>;
  if (error || !data) return <ErrorState message={error} retry={reload}/>;
  return <><Link className="back-link" href="/learn/listening"><ArrowLeft size={17}/> Tất cả bài listening</Link><PageTitle title={data.set.title} description={`${data.set.kind === "dictation" ? "Nghe chép" : "Mô tả tranh"} · ${data.items.length} câu · Nộp cả bài để lưu kết quả`}/>
    {result && <div className="paper-panel listening-result" role="status"><h2>Hoàn thành rồi ní!</h2><p className="result-score">{result.correct}/{result.total}</p><Link href={`/learn/listening/result/${result.id}`} className="button button-mint">Xem kết quả đã lưu</Link></div>}
    {!data.items.length && <div className="paper-panel"><p>Bài này chưa có câu hỏi.</p></div>}
    <div className="listening-list">{data.items.map((item, index) => {
      const answer = result?.answers.find(a => a.id === item.id);
      return <section className="paper-panel" key={item.id}><h2>Câu {index + 1}</h2><Media item={item}/>
        {data.set.kind === "dictation" ? <label className="listening-answer">Nội dung ní nghe được<textarea className="field field-textarea" value={responses[item.id] ?? ""} disabled={Boolean(result)} onChange={e => setResponses({ ...responses, [item.id]: e.target.value })} placeholder="Gõ câu tiếng Anh vào đây"/></label> : <fieldset className="listening-choices" disabled={Boolean(result)}><legend>Chọn câu mô tả đúng</legend>{(["A", "B", "C", "D"] as const).map(letter => <label key={letter}><input type="radio" name={item.id} checked={responses[item.id] === letter} onChange={() => setResponses({ ...responses, [item.id]: letter })}/><span>{letter}</span></label>)}</fieldset>}
        {answer && <div className={`feedback ${answer.correct ? "" : "wrong"}`}><h3>{answer.correct ? "Chính xác!" : "Chưa đúng rồi"}</h3><p>{data.set.kind === "dictation" ? `Đáp án: ${answer.expected}` : `Đáp án: ${answer.expected} · A. ${answer.A} · B. ${answer.B} · C. ${answer.C} · D. ${answer.D}`}</p></div>}
      </section>;
    })}</div>
    {!result && data.items.length > 0 && <div className="quiz-next"><button className="button button-primary" disabled={busy || data.items.some(item => !(responses[item.id] ?? "").trim())} onClick={submit}>{busy ? "Đang chấm..." : "Nộp bài và xem kết quả"}</button></div>}
    {submitError && <div className="notice error spaced" role="alert">{submitError}</div>}
  </>;
}
