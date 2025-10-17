"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

/* ===============================
   START region: /login page
   - Email/Password login via Firebase Auth
   - After login, verify roles/{uid}.role === 'admin'
   - Redirects to /admin (or ?next=…)
   =============================== */

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const snap = await getDoc(doc(db, "roles", cred.user.uid));
      const role = snap.exists() ? (snap.data() as any).role : null;
      if (role === "admin") {
        router.replace(next);
      } else {
        setError("Je bent ingelogd, maar niet als admin.");
      }
    } catch (err: any) {
      setError(err?.message || "Inloggen mislukt.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white border rounded-2xl p-6 shadow-sm space-y-4">
        <h1 className="text-xl font-semibold">Backoffice login</h1>
        <label className="block text-sm">
          E‑mail
          <input
            type="email"
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>
        <label className="block text-sm">
          Wachtwoord
          <input
            type="password"
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </label>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-black text-white px-4 py-2 font-medium disabled:opacity-50"
        >
          {loading ? "Bezig…" : "Log in"}
        </button>
        <p className="text-xs text-neutral-600">
          Zorg dat je e‑maildomein is toegestaan in Firebase Auth &rarr; Settings &rarr; Authorized Domains.
        </p>
      </form>
    </div>
  );
}
// END region: /login page
