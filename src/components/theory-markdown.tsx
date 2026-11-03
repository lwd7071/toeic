import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function TheoryMarkdown({ source }: { source: string }) {
  return <div className="theory-content">
    <ReactMarkdown skipHtml remarkPlugins={[remarkGfm]} components={{
      table: ({ children }) => <div className="theory-table-scroll" role="region" aria-label="Bảng lý thuyết" tabIndex={0}><table>{children}</table></div>,
    }}>{source}</ReactMarkdown>
  </div>;
}
