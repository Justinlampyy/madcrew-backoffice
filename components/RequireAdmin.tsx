'use client'
import { useEffect, useState } from 'react'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, doc, getDoc, setDoc } from 'firebase/firestore'
import { emailIsAdmin } from '@/lib/roles'
import Link from 'next/link'

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading'|'ok'|'nope'>('loading')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setStatus('nope'); return }
      // 1) Check roles collection
      const ref = doc(collection(db, 'roles'), user.uid)
      const snap = await getDoc(ref)
      if (snap.exists() && snap.data().role === 'admin') { setStatus('ok'); return }
      // 2) Bootstrap: if email in env ADMIN_EMAILS -> set as admin
      if (emailIsAdmin(user.email)) {
        await setDoc(ref, { role: 'admin', email: user.email, createdAt: new Date() }, { merge: true })
        setStatus('ok'); return
      }
      setStatus('nope')
    })
    return () => unsub()
  }, [])

  if (status === 'loading') return <div className="card">Bezig met controleren…</div>
  if (status === 'nope') return (
    <div className="card">
      <p className="mb-2">Geen toegang. Log in met een beheerder-account.</p>
      <Link href="/" className="btn">Terug naar login</Link>
    </div>
  )
  return <>{children}</>
}
