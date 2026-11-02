"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { useLoad } from "@/lib/use-load";
import { Mascot } from "@/components/mascot";
import { ErrorState, Loading, PageTitle } from "@/components/ui";

type Data = { lesson: { id:string; title:string; theory:string }; questionCount:number };
export default function Lesson() {
  const id = useParams<{id:string}>().id;
  const router = useRouter();
  const { data, error, loading, reload } = useLoad<Data>(`/api/lessons/${id}`);
  const [busy,setBusy] = useState(false);
  const [startError,setStartError] = useState("");
  async function start() {
    setBusy(true);setStartError("");
    try { const {id:attemptId}=await api<{id:string}>(`/api/lessons/${id}/attempts`,{method:"POST"});router.push(`/learn/quiz/${attemptId}`); }
    catch(cause){setStartError(cause instanceof Error?cause.message:"Không bắt đầu được bài.");setBusy(false)}
  }
  if(loading)return <Loading/>;
  if(error||!data)return <ErrorState message={error} retry={reload}/>;
  return <><Link href="/learn/grammar" className="back-link"><ArrowLeft size={17}/> Tất cả bài ngữ pháp</Link><PageTitle title={data.lesson.title} description={`${data.questionCount} câu hỏi · Học lý thuyết rồi thử sức nhé`}/><div className="theory-layout"><article className="paper-panel theory-content"><ReactMarkdown skipHtml>{data.lesson.theory || "Bài này chưa có phần lý thuyết. Ní có thể bắt đầu luyện tập ngay."}</ReactMarkdown></article><aside className="theory-side"><div><h3>Miu sẵn sàng rồi!</h3><p>Làm từng câu và xem giải thích ngay sau khi chọn.</p><button className="button button-primary" disabled={busy||!data.questionCount} onClick={start}>{busy?"Đang chuẩn bị...":"Bắt đầu luyện tập"}<ArrowRight size={17}/></button>{startError&&<p className="form-error" role="alert">{startError}</p>}</div><Mascot size={160}/></aside></div></>;
}
