"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ErrorState, Loading, PageTitle } from "@/components/ui";
import { useLoad } from "@/lib/use-load";

type Data = { id: string; title: string; kind: "dictation" | "picture"; correct: number; total: number; completedAt: string; answers: { id: string; selected: string; correct: boolean; expected: string; A?: string; B?: string; C?: string; D?: string }[] };
export default function ListeningResult() {
  const id = useParams<{ id: string }>().id;
  const { data, error, loading, reload } = useLoad<Data>(`/api/listening/attempts/${id}`);
  if (loading) return <Loading/>;
  if (error || !data) return <ErrorState message={error} retry={reload}/>;
  return <><Link className="back-link" href="/learn/progress"><ArrowLeft size={17}/> Tiến độ</Link><PageTitle title={data.title} description={`Đã hoàn thành ${new Date(data.completedAt).toLocaleDateString("vi-VN")}`}/><div className="paper-panel listening-result"><p className="result-score">{data.correct}/{data.total}</p><p>câu đúng</p></div><div className="listening-list spaced">{data.answers.map((answer, index) => <div className={`paper-panel answer-review ${answer.correct ? "" : "review-wrong"}`} key={answer.id}><h3>Câu {index + 1} · {answer.correct ? "Đúng" : "Chưa đúng"}</h3><p>Ní trả lời: {answer.selected}</p><p>Đáp án: {answer.expected}</p>{data.kind === "picture" && <p>A. {answer.A} · B. {answer.B} · C. {answer.C} · D. {answer.D}</p>}</div>)}</div></>;
}
