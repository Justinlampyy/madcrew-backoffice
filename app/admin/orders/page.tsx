'use client'
import RequireAdmin from '@/components/RequireAdmin'
import { db } from '@/lib/firebase'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [roundFilter, setRoundFilter] = useState<string>('all')
  const [rounds, setRounds] = useState<any[]>([])

  useEffect(() => {
    const unsubR = onSnapshot(collection(db,'rounds'), snap => setRounds(snap.docs.map(d=>({id:d.id,...d.data()}))))
    const unsub = onSnapshot(collection(db,'orders'), (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => { unsub(); unsubR(); }
  }, [])

  const filtered = useMemo(() => {
    if (roundFilter === 'all') return orders
    return orders.filter(o => o.roundId === roundFilter)
  }, [orders, roundFilter])

  const totals = filtered.reduce((acc, o) => {
    acc.omzet += Number(o.total || 0)
    acc.margin += Number(o.margin || 0)
    return acc
  }, { omzet: 0, margin: 0 })

  return (
    <RequireAdmin>
      <div className="card mb-4">
        <div className="flex items-center gap-3">
          <select className="select w-auto" value={roundFilter} onChange={e => setRoundFilter(e.target.value)}>
            <option value="all">Alle rondes</option>
            {rounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <div className="badge">Totaal omzet: € {totals.omzet.toFixed(2)}</div>
          <div className="badge">Buffer: € {totals.margin.toFixed(2)}</div>
          <div className="badge">Kosten drukker: € {(totals.omzet - totals.margin).toFixed(2)}</div>
        </div>
      </div>
      <div className="card overflow-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Datum</th><th>Naam</th><th>Product</th><th>Kleur</th><th>Maat</th><th>Aantal</th>
              <th>Prijs</th><th>Totaal</th><th>Betaald</th><th>Naar drukker</th><th>Misdruk</th><th>Marge</th><th>Ronde</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => (
              <tr key={o.id}>
                <td>{o.date}</td>
                <td>{o.customer}</td>
                <td>{o.product}</td>
                <td>{o.color}</td>
                <td>{o.size}</td>
                <td>{o.qty}</td>
                <td>€ {Number(o.price||0).toFixed(2)}</td>
                <td>€ {Number(o.total||0).toFixed(2)}</td>
                <td>{o.paid||''}</td>
                <td>{o.sentToPrinter||''}</td>
                <td>{o.misprint ? 'Ja' : ''}</td>
                <td>€ {Number(o.margin||0).toFixed(2)}</td>
                <td>{rounds.find(r=>r.id===o.roundId)?.name||''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </RequireAdmin>
  )
}
