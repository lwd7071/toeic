"use client";

import { useState } from "react";

export function usePagination() {
  const [tokens, setTokens] = useState([""]);
  const [page, setPage] = useState(0);
  return {
    page: page + 1,
    token: tokens[page],
    previous: () => setPage(value => Math.max(0, value - 1)),
    next: (token: string) => { setTokens(value => [...value.slice(0, page + 1), token]); setPage(page + 1); },
    reset: () => { setTokens([""]); setPage(0); },
  };
}

export function useLocalPagination() {
  const [page, setPage] = useState(0);
  return {
    page: page + 1,
    slice: <T,>(items: T[]) => items.slice(page * 20, (page + 1) * 20),
    nextToken: (length: number) => length > (page + 1) * 20 ? String(page + 1) : null,
    previous: () => setPage(value => Math.max(0, value - 1)),
    next: () => setPage(value => value + 1),
    reset: () => setPage(0),
  };
}

export function Pagination({ page, nextPageToken, previous, next }: { page: number; nextPageToken: string | null; previous: () => void; next: (token: string) => void }) {
  if (page === 1 && !nextPageToken) return null;
  return <nav className="pagination" aria-label="Phân trang"><button type="button" className="button button-ghost button-small" disabled={page === 1} onClick={previous}>Trang trước</button><span>Trang {page}</span><button type="button" className="button button-ghost button-small" disabled={!nextPageToken} onClick={() => { if (nextPageToken) next(nextPageToken); }}>Trang tiếp</button></nav>;
}
