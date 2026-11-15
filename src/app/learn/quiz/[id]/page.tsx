"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, RotateCcw, X } from "lucide-react";
import { ErrorState, Loading } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useLoad } from "@/lib/use-load";
import { ViewerUid, invalidateLoadCache } from "@/lib/use-load";

type Choice = "A" | "B" | "C" | "D";
type Question = { id: string; question: string; A: string; B: string; C: string; D: string; correctAnswer?: Choice; explanation?: string };
type Snapshot = Omit<Question, "id"> & { correctAnswer: Choice; explanation: string };
type Answer = { questionId: string; selected: Choice; correct: boolean; snapshot: Snapshot };
type Data = {
  attempt: { id: string; lessonId: string; exerciseId: string; exerciseTitle: string; status: "in_progress" | "complete"; answeredCount: number; correctCount: number; total: number; gradingMode: "batch" | "legacy" };
  questions: Question[];
  answers: Answer[];
};
type SaveResult = { answer: Answer; answeredCount: number; correctCount: number; complete: boolean };
const choices: Choice[] = ["A", "B", "C", "D"];

export default function Quiz() {
  const id = useParams<{ id: string }>().id;
  const uid = useContext(ViewerUid);
  const router = useRouter();
  const { data, error, loading, reload } = useLoad<Data>(`/api/attempts/${id}`);
  const [newAnswers, setNewAnswers] = useState<Record<string, Answer>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [retryBusy, setRetryBusy] = useState(false);
  const [retryError, setRetryError] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const inFlight = useRef(new Set<string>());
  const summaryRef = useRef<HTMLElement>(null);

  useEffect(() => {
    inFlight.current.clear();
    setNewAnswers({});
    setPending(new Set());
    setErrors({});
    setShowSummary(false);
    setRetryBusy(false);
    setRetryError("");
    setSubmitted(false);
    setSubmitError("");
  }, [id]);
  useEffect(() => {
    if (!data || data.attempt.gradingMode !== "batch") return;
    if (data.attempt.status !== "in_progress") { try { sessionStorage.removeItem(`miu_quiz_${uid}_${id}`); } catch {} return; }
    try {
      const stored = JSON.parse(sessionStorage.getItem(`miu_quiz_${uid}_${id}`) ?? "{}") as Record<string, Choice>;
      const restored: Record<string, Answer> = {};
      for (const question of data.questions) {
        const choice = stored[question.id];
        if (!choices.includes(choice) || !question.correctAnswer || question.explanation === undefined) continue;
        restored[question.id] = { questionId: question.id, selected: choice, correct: choice === question.correctAnswer,
          snapshot: { question: question.question, A: question.A, B: question.B, C: question.C, D: question.D, correctAnswer: question.correctAnswer, explanation: question.explanation } };
      }
      setNewAnswers(restored);
    } catch { try { sessionStorage.removeItem(`miu_quiz_${uid}_${id}`); } catch {} }
  }, [data, id, uid]);
  useEffect(() => {
    if (!showSummary) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    summaryRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }, [showSummary]);

  const answers = useMemo(() => {
    const result = new Map(data?.answers.map(answer => [answer.questionId, answer]) ?? []);
    Object.values(newAnswers).forEach(answer => result.set(answer.questionId, answer));
    return result;
  }, [data?.answers, newAnswers]);
  const answered = answers.size;
  const correct = [...answers.values()].filter(answer => answer.correct).length;
  const total = data?.attempt.total ?? 0;
  const complete = total > 0 && answered === total;
  const summaryVisible = complete && (data?.attempt.status === "complete" || submitted) && (showSummary || data?.attempt.status === "complete");

  async function saveAnswer(questionId: string, selected: Choice) {
    if (!data || answers.has(questionId) || inFlight.current.has(questionId) || complete) return;
    if (data.attempt.gradingMode === "batch") {
      const question = data.questions.find(q => q.id === questionId);
      if (!question?.correctAnswer || question.explanation === undefined) return;
      inFlight.current.add(questionId);
      const answer: Answer = { questionId, selected, correct: selected === question.correctAnswer,
        snapshot: { question: question.question, A: question.A, B: question.B, C: question.C, D: question.D, correctAnswer: question.correctAnswer, explanation: question.explanation } };
      setNewAnswers(previous => ({ ...previous, [questionId]: answer }));
      try {
        const key = `miu_quiz_${uid}_${id}`;
        const stored = JSON.parse(sessionStorage.getItem(key) ?? "{}") as Record<string, Choice>;
        sessionStorage.setItem(key, JSON.stringify({ ...stored, [questionId]: selected }));
      } catch { /* The answer remains available in this page when storage is disabled. */ }
      return;
    }
    inFlight.current.add(questionId);
    setPending(previous => new Set(previous).add(questionId));
    setErrors(previous => ({ ...previous, [questionId]: "" }));
    try {
      const result = await api<SaveResult>(`/api/attempts/${id}/answer`, { method: "POST", body: JSON.stringify({ questionId, selected }) });
      setNewAnswers(previous => ({ ...previous, [questionId]: result.answer }));
      if (result.complete) invalidateLoadCache(uid, ["/api/home", "/api/catalog?kind=lessons", `/api/lessons/${data.attempt.lessonId}`, "/api/history?", "/api/study?"]);
    } catch (cause) {
      setErrors(previous => ({ ...previous, [questionId]: cause instanceof Error ? cause.message : "Không lưu được đáp án. Thử lại nhé." }));
    } finally {
      inFlight.current.delete(questionId);
      setPending(previous => { const next = new Set(previous); next.delete(questionId); return next; });
    }
  }

  async function submit() {
    if (!data || !complete || submitBusy) return;
    setSubmitBusy(true); setSubmitError("");
    try {
      const result = await api<{ answers: Answer[] }>(`/api/attempts/${id}/submit`, { method: "POST", body: JSON.stringify({ answers: data.questions.map(q => ({ questionId: q.id, selected: answers.get(q.id)!.selected })) }) });
      setNewAnswers(Object.fromEntries(result.answers.map(answer => [answer.questionId, answer])));
      try { sessionStorage.removeItem(`miu_quiz_${uid}_${id}`); } catch {}
      invalidateLoadCache(uid, ["/api/home", "/api/catalog?kind=lessons", `/api/lessons/${data.attempt.lessonId}`, "/api/history?", "/api/study?"]);
      setSubmitted(true); setShowSummary(true);
    } catch (cause) { setSubmitError(cause instanceof Error ? cause.message : "Không nộp được bài. Thử lại nhé."); }
    finally { setSubmitBusy(false); }
  }

  async function retry() {
    if (!data) return;
    setRetryBusy(true);
    setRetryError("");
    try {
      const result = await api<{ id: string }>(`/api/lessons/${data.attempt.lessonId}/attempts`, { method: "POST", body: JSON.stringify({ exerciseId: data.attempt.exerciseId }) });
      invalidateLoadCache(uid, ["/api/home", "/api/catalog?kind=lessons", `/api/lessons/${data.attempt.lessonId}`]);
      router.push(`/learn/quiz/${result.id}`);
    } catch (cause) {
      setRetryError(cause instanceof Error ? cause.message : "Không làm lại được bài.");
      setRetryBusy(false);
    }
  }

  if (loading) return <Loading/>;
  if (error || !data) return <><ErrorState message={error} retry={reload}/>{error.includes("Đề đã thay đổi") && <p className="center-state"><Link href="/learn/grammar" className="button">Chọn bài để làm lượt mới</Link></p>}</>;
  const wrong = data.questions.flatMap((question, index) => {
    const answer = answers.get(question.id);
    return answer && !answer.correct ? [{ number: index + 1, id: question.id, answer }] : [];
  });

  return <div className="quiz-wrap quiz-flow">
    <Link href={`/learn/grammar/${data.attempt.lessonId}`} className="back-link"><ArrowLeft size={17} aria-hidden="true"/> Về bài học</Link>
    <header className="quiz-progress">
      <h1>{data.attempt.exerciseTitle}</h1>
      <div className="quiz-stats" aria-label="Tiến độ làm bài">
        <span>Đã làm <strong>{answered}/{total}</strong></span>
        <span>Đúng <strong>{correct}</strong></span>
        <span>Sai <strong>{answered - correct}</strong></span>
      </div>
      <div className="progress-track" role="progressbar" aria-label="Tiến độ làm bài" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={total}><span style={{ width: `${total ? answered / total * 100 : 0}%` }}/></div>
    </header>

    {summaryVisible && <section className="quiz-summary" ref={summaryRef} tabIndex={-1} aria-labelledby="quiz-summary-title">
      <p className="quiz-eyebrow">Đã hoàn thành</p>
      <h2 id="quiz-summary-title">Kết quả của ní</h2>
      <p className="quiz-score"><strong>{correct}/{total}</strong> câu đúng</p>
      <p>{wrong.length ? `Có ${wrong.length} câu cần xem lại. Lời giải vẫn nằm ngay dưới từng câu.` : "Tuyệt lắm, ní đã trả lời đúng tất cả!"}</p>
      {wrong.length > 0 && <div className="quiz-wrong-list"><h3>Câu cần xem lại</h3><ul>{wrong.map(item => <li key={item.id}><a href={`#question-${item.id}`}>Câu {item.number}: {item.answer.snapshot.question}</a></li>)}</ul></div>}
      <div className="inline-actions"><button className="button button-primary" onClick={retry} disabled={retryBusy}><RotateCcw size={17} aria-hidden="true"/> Làm lại</button><Link className="button button-ghost" href={`/learn/grammar/${data.attempt.lessonId}`}>Bài tập khác <ArrowRight size={17} aria-hidden="true"/></Link></div>
      {retryError && <p className="form-error" role="alert">{retryError}</p>}
    </section>}

    <div className="quiz-question-list">
      {data.questions.map((question, index) => {
        const answer = answers.get(question.id);
        const saving = pending.has(question.id);
        const locked = Boolean(answer) || saving;
        return <section className="quiz-question" id={`question-${question.id}`} aria-labelledby={`question-title-${question.id}`} key={question.id}>
          <h2 id={`question-title-${question.id}`}><span>Câu {index + 1}.</span> {answer?.snapshot.question ?? question.question}</h2>
          <div className="quiz-options" role="group" aria-labelledby={`question-title-${question.id}`}>
            {choices.map(choice => {
              const correctChoice = answer?.snapshot.correctAnswer === choice;
              const wrongChoice = answer?.selected === choice && !answer.correct;
              return <button key={choice} type="button" className={`quiz-option${correctChoice ? " correct" : ""}${wrongChoice ? " wrong" : ""}`} aria-disabled={locked} aria-pressed={answer?.selected === choice} tabIndex={answer && answer.selected !== choice ? -1 : 0} onClick={() => saveAnswer(question.id, choice)}>
                <span className="quiz-option-letter">{choice}.</span><span>{answer?.snapshot[choice] ?? question[choice]}</span>
                {correctChoice && <Check size={18} aria-hidden="true"/>}{wrongChoice && <X size={18} aria-hidden="true"/>}
              </button>;
            })}
          </div>
          {saving && <p className="quiz-saving" role="status">Đang lưu đáp án...</p>}
          {answer && <div className={`quiz-feedback${answer.correct ? "" : " wrong"}`} role={newAnswers[question.id] ? "status" : "note"}>
            <strong>{answer.correct ? "Đúng rồi!" : "Chưa đúng."} Đáp án: {answer.snapshot.correctAnswer}. {answer.snapshot[answer.snapshot.correctAnswer]}</strong>
            <p>{answer.snapshot.explanation}</p>
          </div>}
          {errors[question.id] && <p className="form-error" role="alert">{errors[question.id]} <button type="button" className="quiz-resync" onClick={async () => { await reload(); setErrors(previous => ({ ...previous, [question.id]: "" })); }}>Tải lại tiến độ</button></p>}
        </section>;
      })}
    </div>
    <div className="quiz-finish"><button className="button button-primary" disabled={!complete || submitBusy} onClick={() => { if (data.attempt.gradingMode === "batch" && !submitted && data.attempt.status !== "complete") void submit(); else { setShowSummary(true); if (showSummary) summaryRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); } }}>{data.attempt.gradingMode === "batch" && !submitted && data.attempt.status !== "complete" ? (submitBusy ? "Đang nộp..." : "Nộp bài") : "Xem kết quả tổng"} <ArrowRight size={17} aria-hidden="true"/></button>{!complete && <p>Trả lời đủ {total} câu để xem kết quả.</p>}{data.attempt.gradingMode === "legacy" && <p>Bài này lưu từng câu trả lời.</p>}{submitError && <p className="form-error" role="alert">{submitError} <button type="button" className="quiz-resync" onClick={reload}>Tải lại tiến độ</button></p>}</div>
  </div>;
}
