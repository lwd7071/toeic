import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TheoryMarkdown } from "./theory-markdown";

describe("TheoryMarkdown", () => {
  it("renders the grammar table and standard emphasis", () => {
    const html = renderToStaticMarkup(<TheoryMarkdown source={"# Đại từ\n\n**Chủ ngữ** và *tân ngữ*\n\n| Ngôi | Chủ ngữ | Tân ngữ |\n| --- | --- | --- |\n| 1 | I | me |\n\n- Ghi nhớ"}/>);
    expect(html).toContain("<table>");
    expect(html).toContain("<th>Chủ ngữ</th>");
    expect(html).toContain("<td>me</td>");
    expect(html).toContain("<strong>Chủ ngữ</strong>");
    expect(html).toContain("<em>tân ngữ</em>");
    expect(html).toContain("<li>Ghi nhớ</li>");
  });

  it("ignores pasted HTML", () => {
    const html = renderToStaticMarkup(<TheoryMarkdown source={"Bài học\n\n<script>alert('bad')</script>"}/>);
    expect(html).toContain("Bài học");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("alert(");
  });
});
