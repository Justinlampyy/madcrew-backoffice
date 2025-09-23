'use client'
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), [])
  return (
    <div className="card">
      <h1 className="text-xl font-semibold mb-2">Welkom</h1>
      <p className="mb-4">Log in om de backoffice te gebruiken.</p>
      {!user ? (
        <button className="btn" onClick={async () => {
          const provider = new GoogleAuthProvider()
          await signInWithPopup(auth, provider)
          router.push('/admin')
        }}>Inloggen met Google</button>
      ) : (
        <div className="flex items-center gap-3">
          <span className="badge">Ingelogd als {user.email}</span>
          <button className="btn" onClick={async () => { await signOut(auth); }}>Uitloggen</button>
          <button className="btn" onClick={() => router.push('/admin')}>Naar Dashboard</button>
        </div>
      )}
    </div>
  )
}
