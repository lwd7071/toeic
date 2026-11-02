"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";

export function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await api<T>(path)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được dữ liệu."); }
    finally { setLoading(false); }
  }, [path]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}
