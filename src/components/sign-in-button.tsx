"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inMemoryPersistence, setPersistence, signInWithPopup, signOut } from "firebase/auth";
import { ArrowRight } from "lucide-react";
import { firebaseAuth, googleProvider } from "@/lib/firebase-client";
import { api } from "@/lib/api-client";

export function SignInButton({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function signIn() {
    setBusy(true); setError("");
    try {
      await setPersistence(firebaseAuth, inMemoryPersistence);
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      await api("/api/auth/session", { method: "POST", body: JSON.stringify({ idToken: await result.user.getIdToken() }) });
      await signOut(firebaseAuth);
      router.push("/learn"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không đăng nhập được. Hãy thử lại."); }
    finally { setBusy(false); }
  }
  return <div className="signin-wrap"><button type="button" className={`button ${compact ? "button-small" : "button-primary"}`} onClick={signIn} disabled={busy}>{busy ? "Đang đăng nhập..." : compact ? "Đăng nhập" : "Bắt đầu học"}<ArrowRight size={compact ? 16 : 18}/></button>{error && <p className="form-error" role="alert">{error}</p>}</div>;
}
