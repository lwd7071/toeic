"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api-client";
import { useLoad } from "@/lib/use-load";
import { ErrorState, Loading, PageTitle } from "@/components/ui";

type Kind = "dictation" | "picture";
type Set = { id: string; title: string; kind: Kind; archivedAt: string | null };
type Item = { id: string; setId: string; audioUrl: string; imageUrl?: string; transcript?: string; A?: string; B?: string; C?: string; D?: string; correctAnswer?: string; archivedAt: string | null };
type Data = { sets: Set[]; items: Item[] };
type Preview = { hash: string; count: number; rows: Record<string, string>[]; errors: string[] };

function MediaCheck({ image, audio }: { image?: string; audio: string }) {
  return <div className="media-check">
    {image && <iframe className="drive-image" src={image.replace(/\/view(?=\?|$)/, "/preview")} title="Ảnh xem trước cho câu mô tả tranh" loading="lazy"/>}
    <iframe className="drive-audio" src={audio.replace(/\/view(?=\?|$)/, "/preview")} title="Nghe MP3 xem trước" loading="lazy" allow="autoplay"/>
    <p>Không thấy ảnh hoặc không nghe được? Mở file trên Drive để kiểm tra quyền chia sẻ.</p>
    <div className="inline-actions">{image && <a href={image} target="_blank" rel="noopener noreferrer">Mở ảnh trên Drive</a>}<a href={audio} target="_blank" rel="noopener noreferrer">Mở MP3 trên Drive</a></div>
  </div>;
}

export default function AdminListening() {
  const { data, error, loading, reload } = useLoad<Data>("/api/admin/listening");
  const [selected, setSelected] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Kind>("dictation");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewRow, setPreviewRow] = useState(0);
  const [editing, setEditing] = useState<Item | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const current = data?.sets.find(s => s.id === selected);
  const items = data?.items.filter(i => i.setId === selected) ?? [];
  useEffect(() => { if (data?.sets.length && !data.sets.some(s => s.id === selected)) setSelected(data.sets[0].id); }, [data, selected]);
  useEffect(() => { setFile(null); setPreview(null); setEditing(null); setFields({}); }, [selected]);
  async function run(task: () => Promise<void>, success: string) {
    setBusy(true); setFailure(""); setMessage("");
    try { await task(); await reload(); setMessage(success); }
    catch (cause) { setFailure(cause instanceof Error ? cause.message : "Không lưu được nội dung."); }
    finally { setBusy(false); }
  }
  async function create() {
    let newId = "";
    await run(async () => { const result = await api<{ id: string }>("/api/admin/listening", { method: "POST", body: JSON.stringify({ title, kind }) }); newId = result.id; setTitle(""); }, "Đã tạo bài listening.");
    if (newId) setSelected(newId);
  }
  async function archive(type: "set" | "item", id: string, archived: boolean) {
    if (!archived && !window.confirm("Ẩn nội dung này khỏi người học? Kết quả cũ vẫn được giữ.")) return;
    await run(() => api(`/api/admin/listening/${type}/${id}`, { method: "PATCH", body: JSON.stringify({ archive: !archived }) }), archived ? "Đã khôi phục." : "Đã ẩn.");
  }
  async function inspect() {
    if (!file || !selected) return;
    setBusy(true); setFailure(""); setPreview(null);
    const form = new FormData(); form.set("setId", selected); form.set("file", file);
    try { setPreview(await api<Preview>("/api/admin/listening/import", { method: "POST", body: form })); setPreviewRow(0); }
    catch (cause) { setFailure(cause instanceof Error ? cause.message : "Không đọc được CSV."); }
    finally { setBusy(false); }
  }
  async function commit() {
    if (!file || !preview || preview.errors.length) return;
    await run(async () => {
      const form = new FormData(); form.set("setId", selected); form.set("file", file); form.set("expectedHash", preview.hash);
      await api("/api/admin/listening/import", { method: "PUT", body: form }); setFile(null); setPreview(null);
    }, `Đã nhập ${preview.count} câu.`);
  }
  function edit(item: Item) { setEditing(item); setFields(Object.fromEntries(Object.entries(item).filter(([, value]) => typeof value === "string")) as Record<string, string>); setFailure(""); }
  async function saveItem() {
    if (!editing) return;
    await run(async () => { await api(`/api/admin/listening/item/${editing.id}`, { method: "PATCH", body: JSON.stringify(fields) }); setEditing(null); }, "Đã sửa câu.");
  }
  if (loading) return <Loading/>;
  if (error || !data) return <ErrorState message={error} retry={reload}/>;
  return <><Link className="back-link" href="/admin"><ArrowLeft size={17}/> Góc quản trị</Link><PageTitle title="Quản lý listening" description="Tạo bài, dán link Drive trong CSV rồi xem thử ảnh và MP3."/>
    <div className="two-col"><section className="paper-panel form-stack"><h2>Tạo bài mới</h2><label>Tên bài<input className="field" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ví dụ: Mô tả tranh 1"/></label><label>Dạng bài<select className="field" value={kind} onChange={e => setKind(e.target.value as Kind)}><option value="dictation">Nghe chép</option><option value="picture">Mô tả tranh</option></select></label><button className="button button-primary" disabled={busy || !title.trim()} onClick={create}>Tạo bài</button></section>
    <section className="paper-panel"><h2>Các bài listening</h2><div className="admin-list">{data.sets.map(s => <div className={`admin-item ${s.archivedAt ? "archived" : ""}`} key={s.id}><div><h3>{s.title}</h3><p>{s.kind === "dictation" ? "Nghe chép" : "Mô tả tranh"} · {data.items.filter(i => i.setId === s.id).length} câu</p></div><div className="admin-actions"><button onClick={() => setSelected(s.id)}>Quản lý</button><button className={s.archivedAt ? "" : "danger"} disabled={busy} onClick={() => archive("set", s.id, Boolean(s.archivedAt))}>{s.archivedAt ? "Khôi phục" : "Ẩn"}</button></div></div>)}</div>{!data.sets.length && <p>Chưa có bài nào.</p>}</section></div>
    {current && <section className="paper-panel spaced"><h2>{current.title}</h2><p>{current.kind === "dictation" ? "CSV: audio_url,transcript" : "CSV: image_url,audio_url,A,B,C,D,correct_answer"}. Link cần trỏ đến file trên Google Drive và được chia sẻ “Bất kỳ ai có đường liên kết – Người xem”. Nên dùng ảnh tối đa 5 MiB, MP3 tối đa 25 MiB; app không kiểm tra được dung lượng file trên Drive.</p><div className="form-stack"><label>Đổi tên bài<input className="field" value={fields.setTitle ?? current.title} onChange={e => setFields({ ...fields, setTitle: e.target.value })}/></label><button className="button button-small" disabled={busy || !(fields.setTitle ?? current.title).trim()} onClick={() => run(() => api(`/api/admin/listening/set/${selected}`, { method: "PATCH", body: JSON.stringify({ title: fields.setTitle ?? current.title }) }), "Đã đổi tên bài.")}>Lưu tên</button></div>
      <div className="import-box"><h3>Nhập câu từ CSV</h3><input type="file" accept=".csv,text/csv" aria-label="Chọn file CSV listening" onChange={e => { setFile(e.target.files?.[0] ?? null); setPreview(null); }}/><button className="button button-small" disabled={!file || busy || Boolean(current.archivedAt)} onClick={inspect}>Xem trước file</button>{preview && <><p className="spaced">{preview.count} dòng hợp lệ · {preview.errors.length} lỗi. Thử mở media của từng câu trước khi nhập.</p>{preview.errors.length > 0 && <div className="notice error" role="alert">{preview.errors.join("\n")}</div>}<div className="import-preview"><table><thead><tr><th>#</th><th>Audio</th><th>Ảnh / nội dung</th><th>Đáp án</th><th>Kiểm tra</th></tr></thead><tbody>{preview.rows.map((r, index) => <tr key={index}><td>{index + 2}</td><td>{r.audioUrl}</td><td>{r.imageUrl ?? r.transcript}</td><td>{r.correctAnswer ? `${r.correctAnswer}: ${r[r.correctAnswer]}` : "—"}</td><td><button onClick={() => setPreviewRow(index)}>Xem</button></td></tr>)}</tbody></table></div>{preview.rows[previewRow] && <MediaCheck key={`${preview.hash}-${previewRow}`} audio={preview.rows[previewRow].audioUrl} image={preview.rows[previewRow].imageUrl}/>}<button className="button button-primary" disabled={busy || preview.errors.length > 0 || Boolean(current.archivedAt)} onClick={commit}>Xác nhận nhập {preview.count} câu</button></>}</div>
      <h3 className="spaced">Các câu ({items.length})</h3><div className="admin-list">{items.map((i, index) => <div className={`admin-item ${i.archivedAt ? "archived" : ""}`} key={i.id}><div><h3>Câu {index + 1}</h3><p>{i.transcript ?? `Đáp án ${i.correctAnswer}`} · {i.audioUrl}</p></div><div className="admin-actions"><button onClick={() => edit(i)}>Sửa / Xem media</button><button className={i.archivedAt ? "" : "danger"} disabled={busy} onClick={() => archive("item", i.id, Boolean(i.archivedAt))}>{i.archivedAt ? "Khôi phục" : "Ẩn"}</button></div></div>)}</div>
    </section>}
    {editing && <section className="paper-panel spaced form-stack"><h2>Sửa câu</h2>{(current?.kind === "dictation" ? ["audioUrl", "transcript"] : ["imageUrl", "audioUrl", "A", "B", "C", "D", "correctAnswer"]).map(key => <label key={key}>{key}<input className="field" value={fields[key] ?? ""} onChange={e => setFields({ ...fields, [key]: e.target.value })}/></label>)}<p>Media đang lưu:</p><MediaCheck key={editing.id} audio={editing.audioUrl} image={editing.imageUrl}/><div className="form-actions"><button className="button button-primary" disabled={busy} onClick={saveItem}>Lưu câu</button><button className="button button-ghost" onClick={() => setEditing(null)}>Hủy</button></div></section>}
    {failure && <div className="notice error spaced" role="alert">{failure}</div>}{message && <div className="notice success spaced" role="status">{message}</div>}
  </>;
}
