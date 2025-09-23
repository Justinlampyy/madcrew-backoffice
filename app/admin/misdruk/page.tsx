'use client'

import RequireAdmin from '@/components/RequireAdmin'
import { db } from '@/lib/firebase'
import { collection, onSnapshot } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type Order = {
  id?: string
  product?: string
  color?: string
  size?: string
  misprint_qty?: number
  resold_qty?: number
  roundId?: string
}
type Round = { id: string; name?: string }

type GroupRow = {
  product: string
  color: string
  size: string
  misdruk: number
  doorverkocht: number
  voorraad: number
}

export default function MisdrukVoorraadPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [roundFilter, setRoundFilter] = useState<string>('all')

  useEffect(() => {
    const unsubR = onSnapshot(collection(db, 'rounds'), (snap) => {
      setRounds(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
    })
    const unsubO = onSnapshot(collection(db, 'orders'), (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
    })
    return () => { unsubR(); unsubO() }
  }, [])

  const filtered = useMemo(() => {
    return roundFilter === 'all'
      ? orders
      : orders.filter(o => o.roundId === roundFilter)
  }, [orders, roundFilter])

  const rows = useMemo<GroupRow[]>(() => {
    const map = new Map<string, GroupRow>()
    for (const o of filtered) {
      const misq = Number(o.misprint_qty || 0)
      const resq = Number(o.resold_qty || 0)
      if (misq === 0 && resq === 0) continue
      const key = `${o.product}||${o.color}||${o.size}`
      const cur = map.get(key) || {
        product: o.product || '',
        color: o.color || '',
        size: o.size || '',
        misdruk: 0,
        doorverkocht: 0,
        voorraad: 0,
      }
      cur.misdruk += misq
      cur.doorverkocht += resq
      cur.voorraad += Math.max(0, misq - resq)
      map.set(key, cur)
    }
    return Array.from(map.values())
      .filter(r => r.voorraad > 0)
      .sort((a, b) =>
        (a.product + a.color).localeCompare(b.product + b.color) ||
        String(a.size).localeCompare(String(b.size))
      )
  }, [filtered])

  return (
    <RequireAdmin>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Misdruk-voorraad</h1>
        <Link href="/admin/orders" className="btn">→ Naar orders</Link>
      </div>

      <div className="card mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <select className="select w-auto" value={roundFilter} onChange={(e)=>setRoundFilter(e.target.value)}>
            <option value="all">Alle rondes</option>
            {rounds.map(r => <option key={r.id} value={r.id}>{r.name || r.id}</option>)}
          </select>
          <div className="badge">Totaal items op voorraad: {rows.reduce((a,r)=>a+r.voorraad,0)}</div>
        </div>
      </div>

      <div className="card overflow-auto">
        {rows.length === 0 ? (
          <div>Geen misdruk-voorraad gevonden{roundFilter!=='all' ? ' voor deze ronde' : ''}.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Kleur</th>
                <th>Maat</th>
                <th>Misdruk (totaal)</th>
                <th>Doorverkocht (totaal)</th>
                <th>Voorraad misdruk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.product}</td>
                  <td>{r.color}</td>
                  <td>{r.size}</td>
                  <td>{r.misdruk}</td>
                  <td>{r.doorverkocht}</td>
                  <td>{r.voorraad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 text-sm opacity-70">
        Tip: doorverkoop afhandelen doe je in <Link href="/admin/orders" className="underline">Orders</Link> met <strong>🔄 Doorverkoop +</strong>.
      </div>
    </RequireAdmin>
  )
}
