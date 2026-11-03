"use client";

import { useId, useState } from "react";
import { TheoryMarkdown } from "./theory-markdown";

export function TheoryEditor({ value, onChange, tall = false }: { value: string; onChange: (value: string) => void; tall?: boolean }) {
  const [preview, setPreview] = useState(false);
  const id = useId();

  return <div className="theory-editor">
    <label htmlFor={id}>Lý thuyết (Markdown cơ bản)</label>
    <div className="theory-editor-tabs" role="group" aria-label="Chế độ hiển thị lý thuyết">
      <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>Soạn thảo</button>
      <button type="button" aria-pressed={preview} onClick={() => setPreview(true)}>Xem trước</button>
    </div>
    {preview
      ? <div className="theory-editor-preview" aria-label="Bản xem trước lý thuyết">{value.trim() ? <TheoryMarkdown source={value}/> : <p>Chưa có lý thuyết. Nhập nội dung ở tab Soạn thảo để xem trước.</p>}</div>
      : <textarea id={id} className={`field field-textarea${tall ? " tall" : ""}`} value={value} onChange={event => onChange(event.target.value)} placeholder="Viết lý thuyết ngắn gọn cho người học..." />}
    <span className="muted">HTML dán vào sẽ không được chạy khi hiển thị.</span>
  </div>;
}
