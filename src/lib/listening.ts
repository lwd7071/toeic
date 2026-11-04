import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { ApiError } from "./errors";

export type ListeningKind = "dictation" | "picture";
export type ListeningSet = { title: string; kind: ListeningKind; archivedAt: string | null; createdAt: string };
export type ListeningItem = { setId: string; audioUrl: string; imageUrl?: string; transcript?: string; A?: string; B?: string; C?: string; D?: string; correctAnswer?: "A" | "B" | "C" | "D"; key: string; archivedAt: string | null; createdAt: string };
export type ListeningAttempt = { uid: string; setId: string; title: string; kind: ListeningKind; correct: number; total: number; completedAt: string };

export function driveLink(value: string): { viewUrl: string; previewUrl: string } {
  let url: URL;
  try { url = new URL(value); } catch { throw new ApiError(400, "Link Google Drive không hợp lệ."); }
  if (url.protocol !== "https:" || url.hostname !== "drive.google.com") throw new ApiError(400, "Chỉ chấp nhận link file Google Drive HTTPS.");
  const id = url.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/)?.[1] ?? (url.pathname === "/open" || url.pathname === "/uc" ? url.searchParams.get("id") : null);
  if (!id || !/^[a-zA-Z0-9_-]{10,}$/.test(id)) throw new ApiError(400, "Link cần trỏ đến một file Google Drive.");
  const resourceKey = url.searchParams.get("resourcekey");
  const suffix = resourceKey ? `?resourcekey=${encodeURIComponent(resourceKey)}` : "";
  return { viewUrl: `https://drive.google.com/file/d/${id}/view${suffix}`, previewUrl: `https://drive.google.com/file/d/${id}/preview${suffix}` };
}

export function normalizedTranscript(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}

export function parseListeningCsv(buffer: Buffer, kind: ListeningKind) {
  if (!buffer.length || buffer.length > 1024 * 1024) throw new ApiError(400, "File CSV phải có dữ liệu và không quá 1 MB.");
  const hash = createHash("sha256").update(buffer).digest("hex");
  let records: string[][];
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    records = parse(buffer, { bom: true, skip_empty_lines: true, relax_quotes: false, relax_column_count: true });
  } catch { throw new ApiError(400, "CSV không hợp lệ hoặc không phải UTF-8."); }
  const header = kind === "dictation" ? ["audio_url", "transcript"] : ["image_url", "audio_url", "A", "B", "C", "D", "correct_answer"];
  if (JSON.stringify(records.shift()?.map(x => x.trim().toLowerCase())) !== JSON.stringify(header.map(x => x.toLowerCase()))) throw new ApiError(400, `Dòng tiêu đề phải là: ${header.join(",")}`);
  if (!records.length || records.length > 200) throw new ApiError(400, "File cần có từ 1 đến 200 dòng dữ liệu.");
  const errors: string[] = [], seen = new Set<string>();
  const rows: (Pick<ListeningItem, "audioUrl" | "imageUrl" | "transcript" | "A" | "B" | "C" | "D" | "correctAnswer" | "key">)[] = [];
  records.forEach((record, index) => {
    const line = index + 2;
    if (record.length !== header.length) { errors.push(`Dòng ${line}: cần đúng ${header.length} cột.`); return; }
    const values = record.map(x => x.trim().normalize("NFC"));
    if (values.some(x => !x || x.length > 1000)) { errors.push(`Dòng ${line}: thiếu dữ liệu hoặc ô dài quá 1000 ký tự.`); return; }
    try {
      const audioUrl = driveLink(values[kind === "dictation" ? 0 : 1]).viewUrl;
      const imageUrl = kind === "picture" ? driveLink(values[0]).viewUrl : undefined;
      const key = `${imageUrl ?? ""}\u0000${audioUrl}`;
      if (seen.has(key)) { errors.push(`Dòng ${line}: trùng media trong file.`); return; }
      seen.add(key);
      if (kind === "dictation") rows.push({ audioUrl, transcript: values[1], key });
      else {
        const answer = values[6].toUpperCase();
        if (!["A", "B", "C", "D"].includes(answer)) { errors.push(`Dòng ${line}: đáp án đúng phải là A, B, C hoặc D.`); return; }
        rows.push({ imageUrl, audioUrl, A: values[2], B: values[3], C: values[4], D: values[5], correctAnswer: answer as ListeningItem["correctAnswer"], key });
      }
    } catch (error) { errors.push(`Dòng ${line}: ${error instanceof Error ? error.message : "link không hợp lệ"}`); }
  });
  return { hash, rows, errors, count: rows.length };
}
