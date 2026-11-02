import { describe, expect, it } from "vitest";
import { parseImport, normalizedKey } from "./csv-import";

describe("CSV import", () => {
  it("handles UTF-8 BOM, quoted comma and escaped quotes", () => {
    const csv = '\uFEFFenglish,vietnamese\n"record, a file","ghi \"\"chép\"\" tài liệu"\n';
    const result = parseImport(Buffer.from(csv), "cards");
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ english: "record, a file", vietnamese: 'ghi "chép" tài liệu' });
  });

  it("allows one word with different meanings and rejects exact normalized duplicates", () => {
    const csv = "english,vietnamese\n Record ,Bản ghi\nrecord,ghi âm\nrecord,bản ghi\n";
    const result = parseImport(Buffer.from(csv), "cards");
    expect(result.rows).toHaveLength(2);
    expect(result.errors).toContain("Dòng 4: trùng cặp từ và nghĩa trong file.");
    expect(normalizedKey(" Record ", "BẢN GHI")).toBe(normalizedKey("record", "bản ghi"));
  });

  it("reports bad quiz answers without accepting that row", () => {
    const csv = "question,A,B,C,D,correct_answer,explanation\nShe ____ here.,is,are,be,been,E,Vì chủ ngữ số ít\n";
    const result = parseImport(Buffer.from(csv), "questions");
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]).toContain("Dòng 2");
  });

  it("rejects the wrong number of columns with a row number", () => {
    const result = parseImport(Buffer.from("english,vietnamese\nhello\n"), "cards");
    expect(result.errors).toContain("Dòng 2: cần đúng 2 cột.");
  });
});
