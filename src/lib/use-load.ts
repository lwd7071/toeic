"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";

export function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);
  const reload = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true); setError("");
    try { const result = await api<T>(path); if (current === requestId.current) setData(result); }
    catch (cause) { if (current === requestId.current) setError(cause instanceof Error ? cause.message : "Không tải được dữ liệu."); }
    finally { if (current === requestId.current) setLoading(false); }
  }, [path]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}
