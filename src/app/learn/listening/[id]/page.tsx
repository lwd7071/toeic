"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useContext, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api-client";
import { useLoad } from "@/lib/use-load";
import { ViewerUid, invalidateLoadCache, primeLoadCache } from "@/lib/use-load";
import { ErrorState, Loading, PageTitle } from "@/components/ui";

type Item = { id: string; audioUrl: string; audioViewUrl: string; imageUrl?: string; imageViewUrl?: string };
type Data = { set: { id: string; title: string; kind: "dictation" | "picture" }; items: Item[] };
type Result = { id: string; correct: number; total: number; answers: { id: string; selected: string; correct: boolean; expected: string; A?: string; B?: string; C?: string; D?: string }[] };
type Feedback = { correct: boolean; expected: string };

// Lazy-mount iframe Google Drive khi cuộn tới để tránh nghẽn băng thông do hàng chục iframe load cùng lúc
function Media({ item, eager = false }: { item: Item; eager?: boolean }) {
  const [visible, setVisible] = useState(eager);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (visible || !ref.current || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "300px" });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [visible]);

  return <div className="listening-media" ref={ref}>
    {item.imageUrl && <>{visible ? <iframe className="drive-image" src={item.imageUrl} title="Tranh cần nghe mô tả" loading="lazy"/> : <div className="drive-image"/>}{item.imageViewUrl && <a href={item.imageViewUrl} target="_blank" rel="noopener noreferrer">Mở ảnh trên Drive nếu khung không hiển thị</a>}</>}
    <div className="drive-audio-frame">{visible && <iframe className="drive-audio" src={item.audioUrl} title="Nghe audio câu hỏi" loading="lazy" allow="autoplay"/>}</div>
    <a href={item.audioViewUrl} target="_blank" rel="noopener noreferrer">Mở MP3 trên Drive</a>
  </div>;
}

export default function ListeningExercise() {
  const id = useParams<{ id: string }>().id;
  const uid = useContext(ViewerUid);
  const router = useRouter();
  const { data, error, loading, reload } = useLoad<Data>(`/api/listening/${id}`, true);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false), [submitError, setSubmitError] = useState("");
  async function check() {
    const item = data?.items[index];
    if (!item || busy || feedback || !(responses[item.id] ?? "").trim()) return;
    setBusy(true); setSubmitError("");
    try {
      setFeedback(await api<Feedback>(`/api/listening/${id}/check`, { method: "POST", body: JSON.stringify({ itemId: item.id, selected: responses[item.id] }) }));
    } catch (cause) { setSubmitError(cause instanceof Error ? cause.message : "Không chấm được câu này."); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (!data || busy) return;
    setBusy(true); setSubmitError("");
    try {
      const saved = await api<Result>(`/api/listening/${id}/submit`, { method: "POST", body: JSON.stringify({ responses: data.items.map(item => ({ id: item.id, selected: responses[item.id] ?? "" })) }) });
      setResult(saved);
      primeLoadCache(uid, `/api/listening/attempts/${saved.id}`, saved);
      invalidateLoadCache(uid, ["/api/home", "/api/catalog?kind=listening", "/api/history?", "/api/study?"]);
      if (data.set.kind === "dictation") router.push(`/learn/listening/result/${saved.id}`);
      else window.scrollTo({ top: 0, behavior: "smooth" });
    }
    catch (cause) { setSubmitError(cause instanceof Error ? cause.message : "Không nộp được bài."); }
    finally { setBusy(false); }
  }
  if (loading) return <Loading/>;
  if (error || !data) return <ErrorState message={error} retry={reload}/>;
  const dictation = data.set.kind === "dictation";
  const current = data.items[index];
  return <><Link className="back-link" href="/learn/listening"><ArrowLeft size={17}/> Tất cả bài listening</Link><PageTitle title={data.set.title} description={`${dictation ? "Nghe chép" : "Mô tả tranh"} · ${data.items.length} câu · ${dictation ? "Chấm từng câu, lưu kết quả cuối bài" : "Nộp cả bài để lưu kết quả"}`}/>
    {result && <div className="paper-panel listening-result" role="status"><h2>Hoàn thành rồi ní!</h2><p className="result-score">{result.correct}/{result.total}</p><Link href={`/learn/listening/result/${result.id}`} className="button button-mint">Xem kết quả đã lưu</Link></div>}
    {!data.items.length && <div className="paper-panel"><p>Bài này chưa có câu hỏi.</p></div>}
    {dictation && current && !result && <div className="listening-list"><section className="paper-panel" key={current.id}>
      <h2>Câu {index + 1} / {data.items.length}</h2><Media item={current} eager/>
      <label className="listening-answer">Nội dung ní nghe được<textarea className="field field-textarea" value={responses[current.id] ?? ""} disabled={Boolean(feedback) || busy} onChange={e => setResponses({ ...responses, [current.id]: e.target.value })} placeholder="Gõ câu tiếng Anh vào đây"/></label>
      {feedback && <div className={`feedback ${feedback.correct ? "" : "wrong"}`} role="status"><h3>{feedback.correct ? "Chính xác!" : "Chưa đúng rồi"}</h3><p>Đáp án: {feedback.expected}</p></div>}
      <div className="quiz-next">{feedback ? <button className="button button-primary" disabled={busy} onClick={() => {
        if (index === data.items.length - 1) void submit();
        else { setIndex(index + 1); setFeedback(null); setSubmitError(""); window.scrollTo({ top: 0, behavior: "smooth" }); }
      }}>{busy ? "Đang lưu..." : index === data.items.length - 1 ? "Hoàn thành và lưu kết quả" : "Câu tiếp theo"}</button> : <button className="button button-primary" disabled={busy || !(responses[current.id] ?? "").trim()} onClick={check}>{busy ? "Đang chấm..." : "Chấm câu này"}</button>}</div>
    </section></div>}
    {!dictation && <div className="listening-list">{data.items.map((item, index) => {
      const answer = result?.answers.find(a => a.id === item.id);
      return <section className="paper-panel" key={item.id}><h2>Câu {index + 1}</h2><Media item={item} eager={index < 2}/>
        <fieldset className="listening-choices" disabled={Boolean(result)}><legend>Chọn câu mô tả đúng</legend>{(["A", "B", "C", "D"] as const).map(letter => <label key={letter}><input type="radio" name={item.id} checked={responses[item.id] === letter} onChange={() => setResponses({ ...responses, [item.id]: letter })}/><span>{letter}</span></label>)}</fieldset>
        {answer && <div className={`feedback ${answer.correct ? "" : "wrong"}`}><h3>{answer.correct ? "Chính xác!" : "Chưa đúng rồi"}</h3><p>Đáp án: {answer.expected} · A. {answer.A} · B. {answer.B} · C. {answer.C} · D. {answer.D}</p></div>}
      </section>;
    })}</div>}
    {!dictation && !result && data.items.length > 0 && <div className="quiz-next"><button className="button button-primary" disabled={busy || data.items.some(item => !(responses[item.id] ?? "").trim())} onClick={submit}>{busy ? "Đang chấm..." : "Nộp bài và xem kết quả"}</button></div>}
    {submitError && <div className="notice error spaced" role="alert">{submitError}</div>}
  </>;
}
