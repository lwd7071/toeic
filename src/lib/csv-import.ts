import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { ApiError } from "./errors";

export type ImportKind = "cards" | "questions";
export type CardRow = { english: string; vietnamese: string; key: string };
export type QuestionRow = { question: string; A: string; B: string; C: string; D: string; correctAnswer: "A"|"B"|"C"|"D"; explanation: string; key: string };
export type ParsedImport = { hash: string; rows: CardRow[] | QuestionRow[]; errors: string[] };

export function normalizedKey(...values: string[]): string {
  return values.map(v => v.trim().normalize("NFC").toLocaleLowerCase("vi")).join("\u0000");
}

export function uniqueId(kind: ImportKind, parentId: string, key: string): string {
  return createHash("sha256").update(`${kind}\u0000${parentId}\u0000${key}`).digest("hex");
}

export function parseImport(buffer: Buffer, kind: ImportKind): ParsedImport {
  if (!buffer.length || buffer.length > 1024 * 1024) throw new ApiError(400, "File CSV phải có dữ liệu và không quá 1 MB.");
  const hash = createHash("sha256").update(buffer).digest("hex");
  let records: string[][];
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    records = parse(buffer, { bom: true, skip_empty_lines: true, relax_quotes: false, relax_column_count: true });
  } catch (error) {
    throw new ApiError(400, `CSV không hợp lệ: ${error instanceof Error ? error.message : "không đọc được file"}`);
  }
  const expected = kind === "cards" ? ["english", "vietnamese"] : ["question", "A", "B", "C", "D", "correct_answer", "explanation"];
  const header = records.shift()?.map(x => x.trim()) ?? [];
  if (header.length !== expected.length || header.some((x, i) => x.toLowerCase() !== expected[i].toLowerCase())) {
    throw new ApiError(400, `Dòng tiêu đề phải là: ${expected.join(",")}`);
  }
  if (!records.length || records.length > 200) throw new ApiError(400, "File cần có từ 1 đến 200 dòng dữ liệu.");
  const errors: string[] = [];
  const seen = new Set<string>();
  const rows: Array<CardRow | QuestionRow> = [];
  records.forEach((record, index) => {
    const line = index + 2;
    if (record.length !== expected.length) { errors.push(`Dòng ${line}: cần đúng ${expected.length} cột.`); return; }
    const values = record.map(x => x.trim().normalize("NFC"));
    if (values.some(x => !x)) { errors.push(`Dòng ${line}: thiếu dữ liệu.`); return; }
    if (values.some(x => x.length > 1000)) { errors.push(`Dòng ${line}: ô dài quá 1000 ký tự.`); return; }
    if (kind === "cards") {
      const [english, vietnamese] = values;
      const key = normalizedKey(english, vietnamese);
      if (seen.has(key)) { errors.push(`Dòng ${line}: trùng cặp từ và nghĩa trong file.`); return; }
      seen.add(key);
      rows.push({ english, vietnamese, key });
    } else {
      const [question, A, B, C, D, answer, explanation] = values;
      if ((question.match(/____/g) ?? []).length !== 1) { errors.push(`Dòng ${line}: câu hỏi cần đúng một chỗ trống ____.`); return; }
      const correctAnswer = answer.toUpperCase();
      if (!["A", "B", "C", "D"].includes(correctAnswer)) { errors.push(`Dòng ${line}: đáp án đúng phải là A, B, C hoặc D.`); return; }
      const key = normalizedKey(question);
      if (seen.has(key)) { errors.push(`Dòng ${line}: trùng câu hỏi trong file.`); return; }
      seen.add(key);
      rows.push({ question, A, B, C, D, correctAnswer: correctAnswer as QuestionRow["correctAnswer"], explanation, key });
    }
  });
  return { hash, rows: rows as CardRow[] | QuestionRow[], errors };
}
