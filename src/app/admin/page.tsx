"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArchiveRestore, FileUp, Plus, Save, Settings2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { useLoad } from "@/lib/use-load";
import { ErrorState, Loading, PageTitle } from "@/components/ui";
import { TheoryEditor } from "@/components/theory-editor";

type Topic = {id:string;title:string;archivedAt:string|null};
type Card = {id:string;topicId:string;english:string;vietnamese:string;archivedAt:string|null};
type Lesson = {id:string;title:string;theory:string;archivedAt:string|null};
type Question = {id:string;lessonId:string;question:string;A:string;B:string;C:string;D:string;correctAnswer:string;explanation:string;archivedAt:string|null};
type Data={topics:Topic[];cards:Card[];lessons:Lesson[];questions:Question[]};
type Preview={hash:string;rows:Record<string,string>[];errors:string[];count:number};

export default function Admin() {
  const {data,error,loading,reload}=useLoad<Data>("/api/admin/content");
  const [tab,setTab]=useState<"cards"|"questions">("cards");
  const [selected,setSelected]=useState("");
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
  const parents=useMemo(()=>tab==="cards"?data?.topics??[]:data?.lessons??[],[tab,data]);
  const current=parents.find(p=>p.id===selected);
  const children=tab==="cards"?(data?.cards??[]).filter(c=>c.topicId===selected):(data?.questions??[]).filter(q=>q.lessonId===selected);
  useEffect(()=>{if(!creating&&parents.length&&!parents.some(p=>p.id===selected)){setSelected(parents[0].id)}},[parents,selected,creating]);
  useEffect(()=>{setTitle(current?.title??"");setTheory(current&&"theory" in current&&typeof current.theory==="string"?current.theory:"");setFile(null);setPreview(null);setEditing(null)},[selected,tab,current?.id]);
  function clearMessage(){setFail("");setNotice("")}
  async function act(task:()=>Promise<unknown>,success:string){setBusy(true);clearMessage();try{await task();setNotice(success);await reload()}catch(cause){setFail(cause instanceof Error?cause.message:"Không lưu được thay đổi.")}finally{setBusy(false)}}
  async function create(){
    setBusy(true);clearMessage();
    try{const result=await api<{id:string}>("/api/admin/content",{method:"POST",body:JSON.stringify({kind:tab==="cards"?"topic":"lesson",title,theory:tab==="questions"?theory:""})});await reload();setSelected(result.id);setCreating(false);setNotice("Đã tạo nội dung mới.")}
    catch(cause){setFail(cause instanceof Error?cause.message:"Không tạo được nội dung.")}
    finally{setBusy(false)}
  }
  async function saveParent(){if(!current)return;await act(()=>api(`/api/admin/content/${tab==="cards"?"topic":"lesson"}/${current.id}`,{method:"PATCH",body:JSON.stringify({title,theory})}),"Đã lưu thay đổi.")}
  async function archive(kind:string,id:string,archived:boolean){
    if(!archived&&!window.confirm("Ẩn nội dung này khỏi người học? Lịch sử học vẫn được giữ."))return;
    await act(()=>api(`/api/admin/content/${kind}/${id}`,{method:"PATCH",body:JSON.stringify({archive:!archived})}),archived?"Đã khôi phục nội dung.":"Đã ẩn nội dung.");
  }
  async function inspect(){
    if(!file||!selected)return;
    setBusy(true);clearMessage();setPreview(null);
    const form=new FormData();form.set("kind",tab);form.set("parentId",selected);form.set("file",file);
    try{setPreview(await api<Preview>("/api/admin/import",{method:"POST",body:form}))}
    catch(cause){setFail(cause instanceof Error?cause.message:"Không đọc được file.")}
    finally{setBusy(false)}
  }
  async function commit(){
    if(!file||!preview||preview.errors.length)return;
    const form=new FormData();form.set("kind",tab);form.set("parentId",selected);form.set("file",file);form.set("expectedHash",preview.hash);
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
  return <><PageTitle title="Góc quản trị" description="Chuẩn bị bài học cho mọi người cùng Miu."/><div className="admin-layout"><aside className="admin-menu"><button className={tab==="cards"?"active":""} onClick={()=>{setTab("cards");setSelected("");setCreating(false)}}>Bộ từ vựng</button><button className={tab==="questions"?"active":""} onClick={()=>{setTab("questions");setSelected("");setCreating(false)}}>Bài ngữ pháp</button><Link className="admin-menu-link" href="/admin/listening">Bài listening</Link></aside><div className="admin-main">
    <div className="admin-toolbar"><h2>{tab==="cards"?"Chủ đề từ vựng":"Bài ngữ pháp"}</h2><button className="button button-primary button-small" onClick={()=>{setCreating(true);setTitle("");setTheory("");setSelected("");setPreview(null)}}><Plus size={17}/> Tạo {tab==="cards"?"chủ đề":"bài học"}</button></div>
    {creating&&<div className="paper-panel form-stack" style={{marginBottom:22}}><h3>{tab==="cards"?"Chủ đề mới":"Bài ngữ pháp mới"}</h3><label>Tên<input className="field" value={title} onChange={e=>setTitle(e.target.value)} placeholder={tab==="cards"?"Ví dụ: Công sở":"Ví dụ: Bài danh từ"}/></label>{tab==="questions"&&<TheoryEditor value={theory} onChange={setTheory}/>}<div className="form-actions"><button className="button button-primary" disabled={busy||!title.trim()} onClick={create}>Tạo mới</button><button className="button button-ghost" onClick={()=>{setCreating(false);setSelected(parents[0]?.id??"")}}>Hủy</button></div></div>}
    <div className="admin-list">{parents.map(parent=><div className={`admin-item ${parent.archivedAt?"archived":""}`} key={parent.id}><div><h3>{parent.title}</h3><p>{parent.archivedAt?"Đã ẩn":"Đang mở"} · {tab==="cards"?data.cards.filter(c=>c.topicId===parent.id).length:data.questions.filter(q=>q.lessonId===parent.id).length} mục</p></div><div className="admin-actions"><button onClick={()=>{setSelected(parent.id);setCreating(false)}}>Quản lý</button><button className={parent.archivedAt?"":"danger"} disabled={busy} onClick={()=>archive(tab==="cards"?"topic":"lesson",parent.id,Boolean(parent.archivedAt))}>{parent.archivedAt?"Khôi phục":"Ẩn"}</button></div></div>)}</div>
    {!parents.length&&!creating&&<div className="paper-panel spaced"><p>Chưa có nội dung. Tạo {tab==="cards"?"chủ đề từ vựng":"bài ngữ pháp"} đầu tiên nhé.</p></div>}
    {current&&!creating&&<section className="paper-panel spaced"><div className="admin-toolbar"><h2><Settings2 size={22} style={{verticalAlign:"middle"}}/> {current.title}</h2><span className={`sticker ${current.archivedAt?"sticker-pink":"sticker-mint"}`}>{current.archivedAt?"Đã ẩn":"Đang mở"}</span></div><div className="form-stack"><label>Tên {tab==="cards"?"chủ đề":"bài học"}<input className="field" value={title} onChange={e=>setTitle(e.target.value)}/></label>{tab==="questions"&&<TheoryEditor key={current.id} value={theory} onChange={setTheory} tall/>}<button className="button button-primary" style={{justifySelf:"start"}} disabled={busy||!title.trim()} onClick={saveParent}><Save size={17}/> Lưu thay đổi</button></div>
    <h3 className="spaced">Nhập {tab==="cards"?"flashcard":"câu hỏi"} từ CSV</h3><div className="import-box"><p>File cần dòng tiêu đề <code>{tab==="cards"?"english,vietnamese":"question,A,B,C,D,correct_answer,explanation"}</code>. Tối đa 200 dòng, 1 MB.</p><input type="file" accept=".csv,text/csv" aria-label="Chọn file CSV" onChange={e=>{setFile(e.target.files?.[0]??null);setPreview(null);clearMessage()}}/><div><button className="button button-small" disabled={!file||busy||Boolean(current.archivedAt)} onClick={inspect}><FileUp size={17}/> Xem trước file</button></div>{preview&&<><p className="spaced"><strong>{preview.count}</strong> dòng hợp lệ · <strong>{preview.errors.length}</strong> lỗi</p>{preview.errors.length>0&&<div className="notice error" role="alert">{preview.errors.join("\n")}</div>}<div className="import-preview"><table><thead><tr><th>#</th>{Object.keys(preview.rows[0]??{}).filter(k=>k!=="key").map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{preview.rows.slice(0,20).map((row,i)=><tr key={i}><td>{i+2}</td>{Object.entries(row).filter(([k])=>k!=="key").map(([k,v])=><td key={k}>{v}</td>)}</tr>)}</tbody></table></div>{preview.count>20&&<p className="muted">Đang hiển thị 20 dòng đầu.</p>}<button className="button button-primary" disabled={busy||preview.errors.length>0||Boolean(current.archivedAt)} onClick={commit}>Xác nhận nhập {preview.count} mục</button></>}</div>
    <h3 className="spaced">{tab==="cards"?"Các thẻ":"Các câu hỏi"} ({children.length})</h3><div className="admin-list">{children.map(item=><div className={`admin-item ${item.archivedAt?"archived":""}`} key={item.id}><div><h3>{"english" in item?item.english:item.question}</h3><p>{"english" in item?item.vietnamese:`Đáp án ${item.correctAnswer} · ${item.explanation}`}</p></div><div className="admin-actions"><button onClick={()=>beginEdit(item)}>Sửa</button><button className={item.archivedAt?"":"danger"} disabled={busy} onClick={()=>archive(tab==="cards"?"card":"question",item.id,Boolean(item.archivedAt))}>{item.archivedAt?"Khôi phục":"Ẩn"}</button></div></div>)}</div>{!children.length&&<p className="muted">Chưa có mục nào trong {tab==="cards"?"chủ đề":"bài"} này.</p>}</section>}
    {editing&&<div className="paper-panel spaced"><h2>Sửa {tab==="cards"?"thẻ":"câu hỏi"}</h2><div className="form-stack">{(tab==="cards"?["english","vietnamese"]:["question","A","B","C","D","correctAnswer","explanation"]).map(key=><label key={key}>{key}<input className="field" value={editFields[key]??""} onChange={e=>setEditFields({...editFields,[key]:e.target.value})}/></label>)}<div className="form-actions"><button className="button button-primary" disabled={busy} onClick={saveItem}>Lưu mục</button><button className="button button-ghost" onClick={()=>setEditing(null)}>Hủy</button></div></div></div>}
    {fail&&<div className="notice error spaced" role="alert">{fail}</div>}{notice&&<div className="notice success spaced" role="status">{notice}</div>}
  </div></div></>;
}
