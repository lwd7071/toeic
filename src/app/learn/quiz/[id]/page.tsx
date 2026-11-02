"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, RotateCcw, X } from "lucide-react";
import { Mascot } from "@/components/mascot";
import { ErrorState, Loading } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useLoad } from "@/lib/use-load";

type Choice = "A"|"B"|"C"|"D";
type Snapshot = {question:string;A:string;B:string;C:string;D:string;correctAnswer:Choice;explanation:string};
type Answer = {questionId:string;selected:Choice;correct:boolean;snapshot:Snapshot};
type Data = { attempt:{id:string;lessonId:string;status:string;answeredCount:number;correctCount:number;total:number}; current:({id:string;question:string;A:string;B:string;C:string;D:string})|null; answers:Answer[] };
type Feedback = {correct:boolean;correctAnswer:Choice;explanation:string;complete:boolean};
const choices:Choice[]=["A","B","C","D"];

export default function Quiz() {
  const id=useParams<{id:string}>().id;
  const router=useRouter();
  const {data,error,loading,reload}=useLoad<Data>(`/api/attempts/${id}`);
  const [selected,setSelected]=useState<Choice|null>(null);
  const [feedback,setFeedback]=useState<Feedback|null>(null);
  const [busy,setBusy]=useState(false);
  const [actionError,setActionError]=useState("");
  async function answer(choice:Choice){
    if(!data?.current||feedback)return;
    setBusy(true);setActionError("");setSelected(choice);
    try{setFeedback(await api<Feedback>(`/api/attempts/${id}/answer`,{method:"POST",body:JSON.stringify({questionId:data.current.id,selected:choice})}));}
    catch(cause){setActionError(cause instanceof Error?cause.message:"Không lưu được câu trả lời.");setSelected(null)}
    finally{setBusy(false)}
  }
  async function next(){setFeedback(null);setSelected(null);await reload()}
  async function retry(){
    if(!data)return;
    setBusy(true);setActionError("");
    try{const result=await api<{id:string}>(`/api/lessons/${data.attempt.lessonId}/attempts`,{method:"POST"});router.push(`/learn/quiz/${result.id}`)}
    catch(cause){setActionError(cause instanceof Error?cause.message:"Không làm lại được bài.");setBusy(false)}
  }
  if(loading)return <Loading/>;
  if(error||!data)return <ErrorState message={error} retry={reload}/>;
  const {attempt,current,answers}=data;
  if(attempt.status==="complete"&&!feedback)return <div className="quiz-wrap"><Link href={`/learn/grammar/${attempt.lessonId}`} className="back-link"><ArrowLeft size={17}/> Về bài học</Link><div className="paper-panel" style={{textAlign:"center"}}><Mascot size={185}/><h1>Giỏi lắm, ní hoàn thành rồi!</h1><p className="result-score">{attempt.correctCount}/{attempt.total}</p><p>Mỗi câu đã làm đều giúp ní nhớ lâu hơn đó.</p><div className="inline-actions" style={{justifyContent:"center"}}><button className="button button-primary" onClick={retry} disabled={busy}><RotateCcw size={17}/> Làm lại</button><Link className="button button-ghost" href="/learn/grammar">Bài khác <ArrowRight size={17}/></Link></div>{actionError&&<p className="form-error" role="alert">{actionError}</p>}</div><div className="section-heading"><h2>Xem lại từng câu</h2></div><div className="paper-panel">{answers.map((a,i)=><div className="answer-review" key={a.questionId}><strong>Câu {i+1}: {a.snapshot.question}</strong><p>{a.correct?<Check size={16} style={{verticalAlign:"middle"}}/>:<X size={16} style={{verticalAlign:"middle"}}/>} Ní chọn {a.selected}: {a.snapshot[a.selected]}</p><p>Đáp án đúng: <strong>{a.snapshot.correctAnswer}. {a.snapshot[a.snapshot.correctAnswer]}</strong></p><p>{a.snapshot.explanation}</p></div>)}</div></div>;
  if(!current)return <ErrorState message="Không tìm thấy câu hỏi hiện tại." retry={reload}/>;
  return <div className="quiz-wrap"><Link href={`/learn/grammar/${attempt.lessonId}`} className="back-link"><ArrowLeft size={17}/> Về lý thuyết</Link><div className="quiz-top"><span>Câu {attempt.answeredCount+1} / {attempt.total}</span><span>{attempt.correctCount + Number(Boolean(feedback?.correct))} câu đúng</span></div><div className="progress-track" style={{maxWidth:"100%",marginBottom:25}}><span style={{width:`${attempt.answeredCount/attempt.total*100}%`}}/></div><div className="quiz-card"><h1>{current.question}</h1><div className="choices">{choices.map(choice=><button key={choice} className={`choice ${feedback&&choice===feedback.correctAnswer?"correct":""} ${feedback&&selected===choice&&!feedback.correct?"wrong":""}`} onClick={()=>answer(choice)} disabled={busy||Boolean(feedback)}><span className="choice-letter">{choice}</span><span>{current[choice]}</span></button>)}</div>{feedback&&<div className={`feedback ${feedback.correct?"":"wrong"}`} role="status"><h3>{feedback.correct?"Đúng rồi! Miu vỗ tay cho ní":"Chưa đúng, mình nhớ lại nhé"}</h3><p>Đáp án: <strong>{feedback.correctAnswer}. {current[feedback.correctAnswer]}</strong></p><p>{feedback.explanation}</p></div>}{actionError&&<p className="form-error" role="alert">{actionError}</p>}{feedback&&<div className="quiz-next"><button className="button button-primary" onClick={next}>{feedback.complete?"Xem kết quả":"Câu tiếp theo"}<ArrowRight size={17}/></button></div>}</div></div>;
}
