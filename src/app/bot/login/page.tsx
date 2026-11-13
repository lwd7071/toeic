"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inMemoryPersistence, setPersistence, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase-client";
import { api } from "@/lib/api-client";

export default function BotLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await setPersistence(firebaseAuth, inMemoryPersistence);
      const result = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      await api("/api/auth/session", { method: "POST", body: JSON.stringify({ idToken: await result.user.getIdToken(), bot: true }) });
      await signOut(firebaseAuth);
      setPassword("");
      router.replace("/admin");
      router.refresh();
    } catch {
      await signOut(firebaseAuth).catch(() => {});
      setError("Không đăng nhập được. Kiểm tra tài khoản và mật khẩu Bot.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="landing"><section className="paper-panel form-stack" style={{ maxWidth: 420, margin: "8vh auto", padding: 28 }}>
    <h1>Đăng nhập Bot</h1>
    <form className="form-stack" onSubmit={login}>
      <label>Tài khoản Bot<input className="field" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required/></label>
      <label>Mật khẩu<input className="field" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required/></label>
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Đang đăng nhập..." : "Đăng nhập"}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  </section></main>;
}
