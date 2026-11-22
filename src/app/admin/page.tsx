"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArchiveRestore, FileUp, Plus, Save, Settings2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { useLoad } from "@/lib/use-load";
import { ErrorState, Loading, PageTitle } from "@/components/ui";
import { TheoryEditor } from "@/components/theory-editor";
import { Pagination, usePagination } from "@/components/pagination";

type Topic = {id:string;title:string;totalCount:number;archivedAt:string|null};
type Card = {id:string;topicId:string;english:string;vietnamese:string;archivedAt:string|null};
type Lesson = {id:string;title:string;theory:string;kind:"theory"|"practice";totalCount:number;archivedAt:string|null};
type Exercise = {id:string;lessonId:string;title:string;totalCount:number;archivedAt:string|null};
type Question = {id:string;lessonId:string;exerciseId:string;question:string;A:string;B:string;C:string;D:string;correctAnswer:string;explanation:string;translation?:string;archivedAt:string|null};
type Data={tab:"cards"|"questions";parentsToken:string;selected:string;parents:(Topic|Lesson)[];parentNextToken:string|null;current:Topic|Lesson|null;exercises:Exercise[];exerciseNextToken:string|null;currentExercise:Exercise|null;children:(Card|Question)[];childNextToken:string|null;isBot:boolean};
type Preview={hash:string;rows:Record<string,string>[];errors:string[];count:number};

export default function Admin() {
  const parentsPage=usePagination(), exercisesPage=usePagination(), childrenPage=usePagination();
  const [tab,setTab]=useState<"cards"|"questions">("cards");
  const [grammarKind,setGrammarKind]=useState<"theory"|"practice">("theory");
  const [selected,setSelected]=useState("");
  const [selectedExercise,setSelectedExercise]=useState("");
  const parentsLoad=useLoad<Pick<Data,"parents"|"parentNextToken"|"isBot">>(`/api/admin/content?section=parents&tab=${tab}&grammarKind=${grammarKind}&parents=${parentsPage.token}`);
  const parentId=selected||parentsLoad.data?.parents[0]?.id||"";
  const detailLoad=useLoad<Pick<Data,"current"|"exercises"|"exerciseNextToken"|"currentExercise">>(`/api/admin/content?section=exercises&tab=${tab}&selected=${parentId}&exercises=${exercisesPage.token}&exercise=${selectedExercise}`);
  const exerciseId=selectedExercise||detailLoad.data?.currentExercise?.id||"";
  const itemsLoad=useLoad<Pick<Data,"children"|"childNextToken">>(`/api/admin/content?section=items&tab=${tab}&selected=${parentId}&exercise=${exerciseId}&children=${childrenPage.token}`);
  const data=parentsLoad.data&&detailLoad.data&&itemsLoad.data?{...parentsLoad.data,...detailLoad.data,...itemsLoad.data,tab,parentsToken:parentsPage.token,selected}:null;
  const error=parentsLoad.error||detailLoad.error||itemsLoad.error;
  const loading=parentsLoad.loading||detailLoad.loading||itemsLoad.loading;
  const reload=async()=>{await Promise.all([parentsLoad.reload(),detailLoad.reload(),itemsLoad.reload()])};
  const [exerciseTitle,setExerciseTitle]=useState("");
  const [creatingExercise,setCreatingExercise]=useState(false);
  const [creating,setCreating]=useState(false);
  const [title,setTitle]=useState("");
  const [theory,setTheory]=useState("");
  const [file,setFile]=useState<File|null>(null);
  const [preview,setPreview]=useState<Preview|null>(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [fail,setFail]=useState("");
  const [editing,setEditing]=useState<Card|Question|null>(null);
  const [editFields,setEditFields]=useState<Record<string,string>>({});
  const parents=data?.parents??[];
  const current=data?.current??null;
  const exercises=data?.exercises??[];
  const currentExercise=data?.currentExercise??null;
  const children=data?.children??[];
  const activeParentId=parentId;
  const activeExerciseId=exerciseId;
  useEffect(()=>{exercisesPage.reset();childrenPage.reset();setSelectedExercise("");setTitle(current?.title??"");setTheory(current&&"theory" in current&&typeof current.theory==="string"?current.theory:"");setFile(null);setPreview(null);setEditing(null)},[selected,tab,current?.id]);
  useEffect(()=>{childrenPage.reset();setExerciseTitle(currentExercise?.title??"");setFile(null);setPreview(null);setEditing(null)},[selectedExercise,currentExercise?.id]);
  function clearMessage(){setFail("");setNotice("")}
  async function act(task:()=>Promise<unknown>,success:string){setBusy(true);clearMessage();try{await task();setNotice(success);await reload()}catch(cause){setFail(cause instanceof Error?cause.message:"Không lưu được thay đổi.")}finally{setBusy(false)}}
  async function create(){
    setBusy(true);clearMessage();
    try{const result=await api<{id:string}>("/api/admin/content",{method:"POST",body:JSON.stringify({kind:tab==="cards"?"topic":"lesson",title,theory:tab==="questions"&&grammarKind==="theory"?theory:"",lessonKind:grammarKind})});await reload();setSelected(result.id);setCreating(false);setNotice("Đã tạo nội dung mới.")}
    catch(cause){setFail(cause instanceof Error?cause.message:"Không tạo được nội dung.")}
    finally{setBusy(false)}
  }
  async function saveParent(){if(!current)return;await act(()=>api(`/api/admin/content/${tab==="cards"?"topic":"lesson"}/${current.id}`,{method:"PATCH",body:JSON.stringify({title,theory:grammarKind==="practice"?"":theory})}),"Đã lưu thay đổi.")}
  async function createExercise(){
    if(!activeParentId||!exerciseTitle.trim())return;
    setBusy(true);clearMessage();
    try{const result=await api<{id:string}>("/api/admin/content",{method:"POST",body:JSON.stringify({kind:"exercise",lessonId:activeParentId,title:exerciseTitle})});await reload();setSelectedExercise(result.id);setCreatingExercise(false);setNotice("Đã tạo bài tập.")}
    catch(cause){setFail(cause instanceof Error?cause.message:"Không tạo được bài tập.")}
    finally{setBusy(false)}
  }
  async function saveExercise(){if(!currentExercise)return;await act(()=>api(`/api/admin/content/exercise/${currentExercise.id}`,{method:"PATCH",body:JSON.stringify({title:exerciseTitle})}),"Đã lưu bài tập.")}
  async function archive(kind:string,id:string,archived:boolean){
    if(!archived&&!window.confirm("Ẩn nội dung này khỏi người học? Lịch sử học vẫn được giữ."))return;
    await act(()=>api(`/api/admin/content/${kind}/${id}`,{method:"PATCH",body:JSON.stringify({archive:!archived})}),archived?"Đã khôi phục nội dung.":"Đã ẩn nội dung.");
  }
  async function inspect(){
    if(!file||!activeParentId||(tab==="questions"&&!activeExerciseId))return;
    setBusy(true);clearMessage();setPreview(null);
    const form=new FormData();form.set("kind",tab);form.set("parentId",tab==="cards"?activeParentId:activeExerciseId);form.set("file",file);
    try{setPreview(await api<Preview>("/api/admin/import",{method:"POST",body:form}))}
    catch(cause){setFail(cause instanceof Error?cause.message:"Không đọc được file.")}
    finally{setBusy(false)}
  }
  async function commit(){
    if(!file||!preview||preview.errors.length)return;
    const form=new FormData();form.set("kind",tab);form.set("parentId",tab==="cards"?activeParentId:activeExerciseId);form.set("file",file);form.set("expectedHash",preview.hash);
    await act(async()=>{const result=await api<{imported:number}>("/api/admin/import",{method:"PUT",body:form});setFile(null);setPreview(null);return result},`Đã nhập ${preview.count} ${tab==="cards"?"thẻ":"câu hỏi"}.`);
  }
  function beginEdit(item:Card|Question){setEditing(item);setEditFields(Object.fromEntries(Object.entries(item).filter(([,v])=>typeof v==="string")) as Record<string,string>);clearMessage()}
  async function saveItem(){
    if(!editing)return;
    const kind=tab==="cards"?"card":"question";
    await act(async()=>{await api(`/api/admin/content/${kind}/${editing.id}`,{method:"PATCH",body:JSON.stringify(editFields)});setEditing(null)},"Đã lưu nội dung.");
  }
  if(loading)return <Loading/>;
  if(error||!data)return <ErrorState message={error} retry={reload}/>;
  return <><PageTitle title="Góc quản trị" description="Chuẩn bị bài học cho mọi người cùng Miu."/><div className="admin-layout"><aside className="admin-menu"><button className={tab==="cards"?"active":""} onClick={()=>{parentsPage.reset();setTab("cards");setSelected("");setCreating(false)}}>Bộ từ vựng</button><button className={tab==="questions"&&grammarKind==="theory"?"active":""} onClick={()=>{parentsPage.reset();setTab("questions");setGrammarKind("theory");setSelected("");setCreating(false)}}>Lý thuyết + bài tập</button><button className={tab==="questions"&&grammarKind==="practice"?"active":""} onClick={()=>{parentsPage.reset();setTab("questions");setGrammarKind("practice");setSelected("");setCreating(false)}}>Bài tập</button><Link className="admin-menu-link" href="/admin/listening">Bài listening</Link>{!data.isBot&&<Link className="admin-menu-link" href="/admin/study">Lịch học viên</Link>}</aside><div className="admin-main">
    <div className="admin-toolbar"><h2>{tab==="cards"?"Chủ đề từ vựng":grammarKind==="theory"?"Lý thuyết + bài tập":"Bài tập"}</h2><button className="button button-primary button-small" onClick={()=>{setCreating(true);setTitle("");setTheory("");setSelected("");setPreview(null)}}><Plus size={17}/> Tạo {tab==="cards"?"chủ đề":"bài học"}</button></div>
    {creating&&<div className="paper-panel form-stack" style={{marginBottom:22}}><h3>{tab==="cards"?"Chủ đề mới":grammarKind==="theory"?"Bài lý thuyết mới":"Bài tập mới"}</h3><label>Tên<input className="field" value={title} onChange={e=>setTitle(e.target.value)} placeholder={tab==="cards"?"Ví dụ: Công sở":"Ví dụ: Bài danh từ"}/></label>{tab==="questions"&&grammarKind==="theory"&&<TheoryEditor value={theory} onChange={setTheory}/>}<div className="form-actions"><button className="button button-primary" disabled={busy||!title.trim()} onClick={create}>Tạo mới</button><button className="button button-ghost" onClick={()=>{setCreating(false);setSelected(parents[0]?.id??"")}}>Hủy</button></div></div>}
    <div className="admin-list">{parents.map(parent=><div className={`admin-item ${parent.archivedAt?"archived":""}`} key={parent.id}><div><h3>{parent.title}</h3><p>{parent.archivedAt?"Đã ẩn":"Đang mở"} · {parent.totalCount??0} mục</p></div><div className="admin-actions"><button onClick={()=>{setSelected(parent.id);setCreating(false)}}>Quản lý</button>{!data.isBot&&<button className={parent.archivedAt?"":"danger"} disabled={busy} onClick={()=>archive(tab==="cards"?"topic":"lesson",parent.id,Boolean(parent.archivedAt))}>{parent.archivedAt?"Khôi phục":"Ẩn"}</button>}</div></div>)}</div>
    <Pagination page={parentsPage.page} nextPageToken={data.parentNextToken} previous={()=>{setSelected("");parentsPage.previous()}} next={token=>{setSelected("");parentsPage.next(token)}}/>{!parents.length&&!creating&&<div className="paper-panel spaced"><p>Chưa có nội dung. Tạo {tab==="cards"?"chủ đề từ vựng":"bài ngữ pháp"} đầu tiên nhé.</p></div>}
    {current&&!creating&&<section className="paper-panel spaced"><div className="admin-toolbar"><h2><Settings2 size={22} style={{verticalAlign:"middle"}}/> {current.title}</h2><span className={`sticker ${current.archivedAt?"sticker-pink":"sticker-mint"}`}>{current.archivedAt?"Đã ẩn":"Đang mở"}</span></div><div className="form-stack"><label>Tên {tab==="cards"?"chủ đề":"bài học"}<input className="field" value={title} onChange={e=>setTitle(e.target.value)}/></label>{tab==="questions"&&grammarKind==="theory"&&<TheoryEditor key={current.id} value={theory} onChange={setTheory} tall/>}<button className="button button-primary" style={{justifySelf:"start"}} disabled={busy||!title.trim()} onClick={saveParent}><Save size={17}/> Lưu thay đổi</button></div>
    {tab==="questions"&&grammarKind==="theory"&&<><div className="admin-toolbar spaced"><h3>Bài tập ({exercises.length})</h3><button className="button button-small" disabled={busy||Boolean(current.archivedAt)} onClick={()=>{setCreatingExercise(true);setExerciseTitle("")}}><Plus size={17}/> Thêm bài tập</button></div>{creatingExercise&&<div className="form-actions"><input className="field" aria-label="Tên bài tập mới" value={exerciseTitle} onChange={e=>setExerciseTitle(e.target.value)} placeholder="Ví dụ: Bài tập nâng cao"/><button className="button button-primary button-small" disabled={busy||!exerciseTitle.trim()} onClick={createExercise}>Tạo bài tập</button><button className="button button-ghost button-small" onClick={()=>{setCreatingExercise(false);setExerciseTitle(currentExercise?.title??"")}}>Hủy</button></div>}<div className="admin-list">{exercises.map(e=><div className={`admin-item ${e.archivedAt?"archived":""}`} key={e.id}><div><h3>{e.title}</h3><p>{e.archivedAt?"Đã ẩn":"Đang mở"} · {e.totalCount??0} câu hỏi</p></div><div className="admin-actions"><button aria-pressed={e.id===selectedExercise} onClick={()=>{setSelectedExercise(e.id);setCreatingExercise(false)}}>Quản lý</button>{!data.isBot&&<button className={e.archivedAt?"":"danger"} disabled={busy} onClick={()=>archive("exercise",e.id,Boolean(e.archivedAt))}>{e.archivedAt?"Khôi phục":"Ẩn"}</button>}</div></div>)}</div>{currentExercise&&<div className="form-actions"><label>Tên bài tập<input className="field" value={creatingExercise?currentExercise.title:exerciseTitle} disabled={creatingExercise} onChange={e=>setExerciseTitle(e.target.value)}/></label><button className="button button-small" disabled={busy||creatingExercise||!exerciseTitle.trim()} onClick={saveExercise}><Save size={17}/> Lưu tên</button></div>}<Pagination page={exercisesPage.page} nextPageToken={data.exerciseNextToken} previous={()=>{setSelectedExercise("");exercisesPage.previous()}} next={token=>{setSelectedExercise("");exercisesPage.next(token)}}/>{!exercises.length&&<p className="muted">Chưa có bài tập. Thêm bài tập để nhập câu hỏi.</p>}</>}
    <h3 className="spaced">Nhập {tab==="cards"?"flashcard":"câu hỏi"} từ CSV {tab==="questions"&&currentExercise?`cho ${currentExercise.title}`:""}</h3><div className="import-box"><p>File cần dòng tiêu đề <code>{tab==="cards"?"english,vietnamese":"question,A,B,C,D,correct_answer,explanation,translation"}</code>. Tối đa 200 dòng, 1 MB.</p><input type="file" accept=".csv,text/csv" aria-label="Chọn file CSV" onChange={e=>{setFile(e.target.files?.[0]??null);setPreview(null);clearMessage()}}/><div><button className="button button-small" disabled={!file||busy||Boolean(current.archivedAt)||(tab==="questions"&&(!currentExercise||Boolean(currentExercise.archivedAt)))} onClick={inspect}><FileUp size={17}/> Xem trước file</button></div>{preview&&<><p className="spaced"><strong>{preview.count}</strong> dòng hợp lệ · <strong>{preview.errors.length}</strong> lỗi</p>{preview.errors.length>0&&<div className="notice error" role="alert">{preview.errors.join("\n")}</div>}<div className="import-preview"><table><thead><tr><th>#</th>{Object.keys(preview.rows[0]??{}).filter(k=>k!=="key").map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{preview.rows.slice(0,20).map((row,i)=><tr key={i}><td>{i+2}</td>{Object.entries(row).filter(([k])=>k!=="key").map(([k,v])=><td key={k}>{v}</td>)}</tr>)}</tbody></table></div>{preview.count>20&&<p className="muted">Đang hiển thị 20 dòng đầu.</p>}<button className="button button-primary" disabled={busy||preview.errors.length>0||Boolean(current.archivedAt)||(tab==="questions"&&(!currentExercise||Boolean(currentExercise.archivedAt)))} onClick={commit}>Xác nhận nhập {preview.count} mục</button></>}</div>
    <h3 className="spaced">{tab==="cards"?"Các thẻ":"Các câu hỏi"} ({tab==="cards"?current.totalCount:(currentExercise?.totalCount??0)})</h3><div className="admin-list">{children.map(item=><div className={`admin-item ${item.archivedAt?"archived":""}`} key={item.id}><div><h3>{"english" in item?item.english:item.question}</h3><p>{"english" in item?item.vietnamese:`Đáp án ${item.correctAnswer} · ${item.explanation}`}</p>{"question" in item&&item.translation&&<p>Câu dịch: {item.translation}</p>}</div><div className="admin-actions"><button onClick={()=>beginEdit(item)}>Sửa</button>{!data.isBot&&<button className={item.archivedAt?"":"danger"} disabled={busy} onClick={()=>archive(tab==="cards"?"card":"question",item.id,Boolean(item.archivedAt))}>{item.archivedAt?"Khôi phục":"Ẩn"}</button>}</div></div>)}</div><Pagination page={childrenPage.page} nextPageToken={data.childNextToken} previous={childrenPage.previous} next={childrenPage.next}/>{!children.length&&<p className="muted">Chưa có mục nào trong {tab==="cards"?"chủ đề":"bài"} này.</p>}</section>}
    {editing&&<div className="paper-panel spaced"><h2>Sửa {tab==="cards"?"thẻ":"câu hỏi"}</h2><div className="form-stack">{(tab==="cards"?["english","vietnamese"]:["question","A","B","C","D","correctAnswer","explanation","translation"]).map(key=><label key={key}>{key==="translation"?"Câu dịch":key}<input className="field" value={editFields[key]??""} onChange={e=>setEditFields({...editFields,[key]:e.target.value})}/></label>)}<div className="form-actions"><button className="button button-primary" disabled={busy} onClick={saveItem}>Lưu mục</button><button className="button button-ghost" onClick={()=>setEditing(null)}>Hủy</button></div></div></div>}
    {fail&&<div className="notice error spaced" role="alert">{fail}</div>}{notice&&<div className="notice success spaced" role="status">{notice}</div>}
  </div></div></>;
}
