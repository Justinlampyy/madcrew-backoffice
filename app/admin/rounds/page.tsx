'use client'
import RequireAdmin from '@/components/RequireAdmin'
import { db } from '@/lib/firebase'
import { addDoc, collection, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function RoundsPage() {
  const [rounds, setRounds] = useState<any[]>([])
  const [name, setName] = useState('')

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'rounds'), (snap) => {
      setRounds(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  const add = async () => {
    if (!name.trim()) return
    await addDoc(collection(db, 'rounds'), { name, status: 'open', createdAt: new Date() })
    setName('')
  }

  return (
    <RequireAdmin>
      <div className="grid gap-4">
        <div className="card">
          <h2 className="font-semibold mb-2">Nieuwe bestelronde</h2>
          <div className="flex gap-2">
            <input className="input" placeholder="Naam ronde (bijv. 'Bestelronde 1')" value={name} onChange={e => setName(e.target.value)} />
            <button className="btn" onClick={add}>Maak ronde</button>
          </div>
        </div>
        <div className="card">
          <h2 className="font-semibold mb-2">Rondes</h2>
          <ul className="list-disc pl-5 space-y-2">
            {rounds.map(r => (
              <li key={r.id} className="flex items-center gap-3">
                <span>{r.name} <span className="badge">{r.status}</span></span>
                <Link className="btn" href={`/admin/rounds/${r.id}/drukker`}>Overzicht voor drukker</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </RequireAdmin>
  )
}
