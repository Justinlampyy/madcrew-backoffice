"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { emailIsAdmin } from "@/lib/roles";

/* ==============================================
   START region: /login (Google) with Suspense wrapper
   ============================================== */

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-neutral-600">Laden…</div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin";

  useEffect(() => {
    // Handle redirect-based sign-in results (for pop-up blockers or mobile)
    getRedirectResult(auth).catch(() => {});
  }, []);

  async function afterLogin() {
    const user = auth.currentUser;
    if (!user) return;
    const roleRef = doc(db, "roles", user.uid);
    const snap = await getDoc(roleRef);
    const isAdminDoc = snap.exists() && (snap.data() as any).role === "admin";
    const isAllowlisted = emailIsAdmin(user.email);

    if (isAllowlisted && !isAdminDoc) {
      await setDoc(roleRef, { role: "admin", email: user.email, createdAt: new Date() as any }, { merge: true });
    }
    const latest = await getDoc(roleRef);
    const adminNow = latest.exists() && (latest.data() as any).role === "admin";
    if (adminNow) router.replace(next);
    else setError("Je bent wel ingelogd, maar niet gemachtigd voor de backoffice.");
  }

  async function signIn() {
    setError(null);
    setBusy(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(auth, provider);
      await afterLogin();
    } catch (e: any) {
      // Fallback to redirect if popup is blocked
      if (String(e?.message || "").toLowerCase().includes("popup")) {
        try {
          await signInWithRedirect(auth, provider);
          return; // browser will redirect back
        } catch (err: any) {
          setError(err?.message || "Inloggen via redirect mislukt.");
        }
      } else {
        setError(e?.message || "Inloggen mislukt.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function doSignOut() {
    await signOut(auth);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-sm bg-white border rounded-2xl p-6 shadow-sm space-y-4">
        <h1 className="text-xl font-semibold">Backoffice login</h1>
        <p className="text-sm text-neutral-700">Log in met je Google-account.</p>

        <button
          onClick={signIn}
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-black text-white px-4 py-2 font-medium disabled:opacity-50"
        >
          {busy ? "Bezig…" : (<><GoogleIcon /> Inloggen met Google</>)}
        </button>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="text-xs text-neutral-600">
          Zorg dat <strong>Google</strong> is ingeschakeld in Firebase &rarr; Authentication &rarr; Sign-in method, en dat je Vercel domein staat bij{" "}
          <em>Authorized domains</em>. Toegang tot de backoffice wordt bepaald door de <code>roles</code>-collectie of door de e-mail-allowlist.
        </div>

        <div className="flex items-center justify-between text-xs">
          <Link href="/">← Terug naar site</Link>
          <button onClick={doSignOut} className="underline">Uitloggen</button>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303C33.875,31.663,29.418,35,24,35c-6.627,0-12-5.373-12-12 s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C33.64,5.053,28.999,3,24,3C12.955,3,4,11.955,4,23s8.955,20,20,20 s19-8.955,19-20C43,22.659,43.246,21.35,43.611,20.083z"/>
      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,16.548,19.004,14,24,14c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657 C33.64,5.053,28.999,3,24,3C16.318,3,9.656,7.337,6.306,14.691z"/>
      <path fill="#4CAF50" d="M24,43c5.364,0,9.993-1.98,13.327-5.363l-6.147-5.197C29.171,34.091,26.715,35,24,35 c-5.392,0-9.837-3.356-11.294-8.003l-6.541,5.04C9.46,39.556,16.07,43,24,43z"/>
      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-1.279,3.663-4.736,7-11.303,7c-6.627,0-12-5.373-12-12 s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C33.64,5.053,28.999,3,24,3C12.955,3,4,11.955,4,23 s8.955,20,20,20s19-8.955,19-20C43,22.659,43.246,21.35,43.611,20.083z"/>
    </svg>
  );
}
// END region: /login (Google) with Suspense wrapper