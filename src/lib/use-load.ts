"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";

export const ViewerUid = createContext("");
const saved = new Map<string, unknown>();
export function clearLoadCache(uid: string) {
  for (const key of saved.keys()) if (key.startsWith(`${uid}:`)) saved.delete(key);
  try { for (const key of Object.keys(sessionStorage)) if (key.startsWith(`miu_quiz_${uid}_`)) sessionStorage.removeItem(key); } catch { /* Browser storage may be disabled. */ }
}
export function invalidateLoadCache(uid: string, paths: string[]) { for (const key of saved.keys()) if (paths.some(path => key.startsWith(`${uid}:${path}`))) saved.delete(key); }
export function primeLoadCache(uid: string, path: string, value: unknown) { saved.set(`${uid}:${path}`, value); }

export function useLoad<T>(path: string, cache = false) {
  const uid = useContext(ViewerUid);
  const key = `${uid}:${path}`;
  const [data, setData] = useState<T | null>(null);
  const [dataKey, setDataKey] = useState("");
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState("");
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);
  const reload = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true); setError("");
    try { const result = await api<T>(path); if (current === requestId.current) { setData(result); setDataKey(key); if (cache && uid) primeLoadCache(uid, path, result); } }
    catch (cause) { if (current === requestId.current) { setError(cause instanceof Error ? cause.message : "Không tải được dữ liệu."); setErrorKey(key); } }
    finally { if (current === requestId.current) setLoading(false); }
  }, [path, cache, uid, key]);
  useEffect(() => {
    if (cache && uid && saved.has(key)) { requestId.current++; setData(saved.get(key) as T); setDataKey(key); setLoading(false); setError(""); }
    else void reload();
  }, [cache, uid, key, reload]);
  return { data: dataKey === key ? data : null, error: errorKey === key ? error : "", loading: loading || (dataKey !== key && errorKey !== key), reload, setData: (value: T) => { setData(value); setDataKey(key); if (cache && uid) primeLoadCache(uid, path, value); } };
}
