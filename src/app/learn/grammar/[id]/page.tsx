"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { useLoad } from "@/lib/use-load";
import { TheoryMarkdown } from "@/components/theory-markdown";
import { EmptyState, ErrorState, Loading, PageTitle } from "@/components/ui";
import { Pagination, usePagination } from "@/components/pagination";

type Data = { lesson: { id:string; title:string; theory:string }; questionCount:number; nextPageToken:string|null; exercises:{id:string;title:string;questionCount:number;lastAttempt:{status:string;correct:number;answered:number;total:number}|null}[] };
export default function Lesson() {
  const id = useParams<{id:string}>().id;
  const router = useRouter();
  const pagination = usePagination();
  const { data, error, loading, reload } = useLoad<Data>(`/api/lessons/${id}?pageToken=${pagination.token}`);
  const [busy,setBusy] = useState("");
  const [startError,setStartError] = useState("");
  async function start(exerciseId:string) {
    setBusy(exerciseId);setStartError("");
    try { const {id:attemptId}=await api<{id:string}>(`/api/lessons/${id}/attempts`,{method:"POST",body:JSON.stringify({exerciseId})});router.push(`/learn/quiz/${attemptId}`); }
    catch(cause){setStartError(cause instanceof Error?cause.message:"Không bắt đầu được bài.");setBusy("")}
  }
  if(loading)return <Loading/>;
  if(error||!data)return <ErrorState message={error} retry={reload}/>;
  return <><Link href="/learn/grammar" className="back-link"><ArrowLeft size={17}/> Tất cả bài ngữ pháp</Link><PageTitle title={data.lesson.title} description={`${data.questionCount} câu hỏi · Học lý thuyết rồi thử sức nhé`}/><article className="paper-panel"><TheoryMarkdown source={data.lesson.theory || "Bài này chưa có phần lý thuyết. Ní có thể bắt đầu luyện tập ngay."}/></article><div className="section-heading"><h2>Chọn bài tập</h2></div>{data.exercises.length?<div className="lesson-list">{data.exercises.map((exercise,index)=><div className="lesson-row" key={exercise.id}><span className="lesson-number">{String((pagination.page-1)*20+index+1).padStart(2,"0")}</span><span><h3>{exercise.title}</h3><p>{exercise.questionCount} câu hỏi · {exercise.lastAttempt?exercise.lastAttempt.status==="complete"?`Lần gần nhất: ${exercise.lastAttempt.correct}/${exercise.lastAttempt.total}`:`Đang làm dở ${exercise.lastAttempt.answered}/${exercise.lastAttempt.total}`:"Chưa làm"}</p></span><button className="button button-primary button-small" disabled={Boolean(busy)||!exercise.questionCount} onClick={()=>start(exercise.id)}>{busy===exercise.id?"Đang chuẩn bị...":"Bắt đầu luyện tập"}<ArrowRight size={17}/></button></div>)}</div>:<EmptyState title="Chưa có bài tập" detail="Admin sẽ thêm bài tập để ní luyện sau nhé."/>}<Pagination page={pagination.page} nextPageToken={data.nextPageToken} previous={pagination.previous} next={pagination.next}/>{startError&&<p className="form-error" role="alert">{startError}</p>}</>;
}
