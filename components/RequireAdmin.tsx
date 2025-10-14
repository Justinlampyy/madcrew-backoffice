// components/RequireAdmin.tsx
'use client'
import { useEffect, useState } from 'react'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, doc, getDoc, setDoc } from 'firebase/firestore'
import { emailIsAdmin } from '@/lib/roles'
import Link from 'next/link'

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading'|'ok'|'nope'|'error'>('loading')
  const [err, setErr] = useState<string>('')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) { setStatus('nope'); return }
        const ref = doc(collection(db, 'roles'), user.uid)
        const snap = await getDoc(ref)
        if (snap.exists() && (snap.data() as any).role === 'admin') { setStatus('ok'); return }
        if (emailIsAdmin(user.email)) {
          await setDoc(ref, { role: 'admin', email: user.email, createdAt: new Date() }, { merge: true })
          setStatus('ok'); return
        }
        setStatus('nope')
      } catch (e: any) {
        console.error('RequireAdmin error:', e)
        setErr(String(e?.message || e))
        setStatus('error')
      }
    })
    return () => unsub()
  }, [])

  if (status === 'loading') return <div className="card">Bezig met controleren…</div>
  if (status === 'nope') return (
    <div className="card">
      <p className="mb-2">Geen toegang. Log in met een beheerder-account.</p>
      <Link href="/login" className="btn">Inloggen</Link>
    </div>
  )
  if (status === 'error') return (
    <div className="card">
      <p className="mb-2">Er ging iets mis bij het controleren van je rechten.</p>
      <pre className="text-xs opacity-70 overflow-auto">{err}</pre>
    </div>
  )
  return <>{children}</>
}
