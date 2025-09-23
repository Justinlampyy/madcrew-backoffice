'use client'
import RequireAdmin from '@/components/RequireAdmin'
import { db } from '@/lib/firebase'
import {
  addDoc, collection, doc, onSnapshot, query, updateDoc, where, serverTimestamp
} from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'

type Order = {
  id?: string
  date?: string
  customer?: string
  product?: string
  color?: string
  size?: string
  qty?: number
  price?: number
  total?: number
  margin?: number
  paid?: boolean | string
  sentToPrinter?: boolean | string
  delivered?: boolean | string
  misprint?: boolean
  resold?: boolean
  roundId?: string
  seq?: number
}

function toBool(v: any): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return v.trim().toLowerCase() === 'ja'
  return !!v
}
function euro(n: number) {
  return `€ ${Number(n || 0).toFixed(2)}`
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [rounds, setRounds] = useState<any[]>([])
  const [roundFilter, setRoundFilter] = useState<string>('all')
  const [bufferTx, setBufferTx] = useState<any[]>([])

  useEffect(() => {
    const unsubR = onSnapshot(collection(db,'rounds'), snap => {
      setRounds(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    const unsubO = onSnapshot(collection(db,'orders'), (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)))
    })
    return () => { unsubR(); unsubO() }
  }, [])

  useEffect(() => {
    if (roundFilter === 'all') {
      const unsub = onSnapshot(collection(db, 'buffer_tx'), (snap) => {
        setBufferTx(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      })
      return () => unsub()
    } else {
      const qref = query(collection(db, 'buffer_tx'), where('roundId','==', roundFilter))
      const unsub = onSnapshot(qref, (snap) => {
        setBufferTx(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      })
      return () => unsub()
    }
  }, [roundFilter])

  const filtered = useMemo(() => {
    if (roundFilter === 'all') return orders
    return orders.filter(o => o.roundId === roundFilter)
  }, [orders, roundFilter])

  // Sorteer: binnen één ronde op seq; anders op datum
  const sorted = useMemo(() => {
    const arr = [...filtered]
    if (roundFilter !== 'all' && arr.some(o => typeof (o as any).seq === 'number')) {
      return arr.sort((a: any, b: any) => (a.seq ?? 0) - (b.seq ?? 0))
    }
    return arr.sort((a, b) => String(a.date).localeCompare(String(b.date)))
  }, [filtered, roundFilter])

  const kpis = useMemo(() => {
    const base = sorted.reduce((acc, o) => {
      const t = Number(o.total || 0)
      const m = Number(o.margin || 0)
      acc.omzet += t
      acc.buffer_from_margin += m
      return acc
    }, { omzet: 0, buffer_from_margin: 0 })
    const txSum = bufferTx
      .filter(tx => roundFilter === 'all' ? true : tx.roundId === roundFilter)
      .reduce((a, tx) => a + Number(tx.amount || 0), 0)

    const buffer = base.buffer_from_margin + txSum
    const kosten_drukker = Math.max(0, base.omzet - base.buffer_from_margin)
    return { omzet: base.omzet, buffer, kosten_drukker, tx: txSum, margin: base.buffer_from_margin }
  }, [sorted, bufferTx, roundFilter])

  const costTotals = (o: Order) => {
    const total = Number(o.total || 0)
    const margin = Number(o.margin || 0)
    const costTotal = Math.max(0, total - margin)
    const qty = Number(o.qty || 0)
    const unitCost = qty > 0 ? costTotal / qty : 0
    return { costTotal, unitCost }
  }

  async function auditLog(orderId: string, roundId: string | undefined, action: string, note?: string, delta?: Record<string, any>) {
    await addDoc(collection(db, 'audit'), {
      orderId,
      roundId: roundId || null,
      action,
      note: note || null,
      delta: delta || null,
      createdAt: serverTimestamp(),
    })
  }

  async function addBufferTx(o: Order, type: 'misprint'|'resold'|'adjust', amount: number, note?: string) {
    await addDoc(collection(db, 'buffer_tx'), {
      orderId: o.id || null,
      roundId: o.roundId || null,
      type,
      amount: Number(amount || 0),
      note: note || null,
      createdAt: serverTimestamp(),
    })
  }

  async function setPaid(o: Order, v: boolean) {
    if (!o.id) return
    await updateDoc(doc(db,'orders', o.id), { paid: v })
    await auditLog(o.id, o.roundId, 'set_paid', v ? 'Betaald = true' : 'Betaald = false')
  }

  async function setSentToPrinter(o: Order, v: boolean) {
    if (!o.id) return
    await updateDoc(doc(db,'orders', o.id), { sentToPrinter: v })
    await auditLog(o.id, o.roundId, 'set_sent_to_printer', v ? 'Naar drukker = true' : 'Naar drukker = false')
  }

  async function setDelivered(o: Order, v: boolean) {
    if (!o.id) return
    await updateDoc(doc(db,'orders', o.id), { delivered: v })
    await auditLog(o.id, o.roundId, 'set_delivered', v ? 'Geleverd = true' : 'Geleverd = false')
  }

  async function markMisprint(o: Order) {
    if (!o.id) return
    if (toBool(o.misprint)) return
    const { costTotal } = costTotals(o)
    await updateDoc(doc(db,'orders', o.id), { misprint: true, misprintAt: new Date() })
    await addBufferTx(o, 'misprint', -costTotal, 'Misdruk – inkoop (vervanging) uit buffer')
    await auditLog(o.id, o.roundId, 'mark_misprint', `Misdruk → -${euro(costTotal)} uit buffer`, { misprint: { from: false, to: true } })
  }

  async function markResold(o: Order) {
    if (!o.id) return
    if (!toBool(o.misprint)) { alert('Markeer eerst als misdruk.'); return }
    if (toBool(o.resold)) return
    const { costTotal } = costTotals(o)
    const input = window.prompt('Verkoopbedrag van het misdruk-artikel (laat leeg om alleen kostprijs te compenseren):', '')
    let amount = Number(input)
    if (!input || isNaN(amount) || amount <= 0) amount = costTotal

    await updateDoc(doc(db,'orders', o.id), { resold: true, resoldAt: new Date(), resoldAmount: amount })
    await addBufferTx(o, 'resold', amount, 'Doorverkoop misdruk → terug naar buffer')
    await auditLog(o.id, o.roundId, 'mark_resold', `Doorverkocht → +${euro(amount)} naar buffer`, { resold: { from: false, to: true }, resoldAmount: amount })
  }

  return (
    <RequireAdmin>
      <div className="card mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <select className="select w-auto" value={roundFilter} onChange={e => setRoundFilter(e.target.value)}>
            <option value="all">Alle rondes</option>
            {rounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <div className="badge">Totaal omzet: {euro(kpis.omzet)}</div>
          <div className="badge">Buffer (marges + transacties): {euro(kpis.buffer)}</div>
          <div className="badge">Waarvan marges: {euro(kpis.margin)}</div>
          <div className="badge">Transacties buffer (som): {euro(kpis.tx)}</div>
          <div className="badge">Kosten drukker (geschat): {euro(kpis.kosten_drukker)}</div>
        </div>
      </div>

      <div className="card overflow-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Naam</th>
              <th>Product</th>
              <th>Kleur</th>
              <th>Maat</th>
              <th>Aantal</th>
              <th>Prijs</th>
              <th>Totaal</th>
              <th>Inkoop/stuk</th>
              <th>Inkoop totaal</th>
              <th>Betaald</th>
              <th>Naar drukker</th>
              <th>Geleverd</th>
              <th>Misdruk</th>
              <th>Doorverkocht</th>
              <th>Acties</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(o => {
              const { unitCost, costTotal } = costTotals(o)
              return (
                <tr key={o.id}>
                  <td>{o.date}</td>
                  <td>{o.customer}</td>
                  <td>{o.product}</td>
                  <td>{o.color}</td>
                  <td>{o.size}</td>
                  <td>{o.qty}</td>
                  <td>{euro(Number(o.price||0))}</td>
                  <td>{euro(Number(o.total||0))}</td>
                  <td>{euro(unitCost)}</td>
                  <td>{euro(costTotal)}</td>
                  <td>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={toBool(o.paid)} onChange={(e)=>setPaid(o, e.target.checked)} />
                      <span>Betaald</span>
                    </label>
                  </td>
                  <td>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={toBool(o.sentToPrinter)} onChange={(e)=>setSentToPrinter(o, e.target.checked)} />
                      <span>Naar drukker</span>
                    </label>
                  </td>
                  <td>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={toBool(o.delivered)} onChange={(e)=>setDelivered(o, e.target.checked)} />
                      <span>Geleverd</span>
                    </label>
                  </td>
                  <td>{toBool(o.misprint) ? 'Ja' : ''}</td>
                  <td>{toBool(o.resold) ? 'Ja' : ''}</td>
                  <td className="whitespace-nowrap">
                    <div className="flex flex-wrap gap-2">
                      <button className="btn" disabled={toBool(o.misprint)} onClick={() => markMisprint(o)} title={toBool(o.misprint) ? 'Al als misdruk' : 'Markeer als misdruk'}>⚠️ Misdruk</button>
                      <button className="btn" disabled={!toBool(o.misprint) || toBool(o.resold)} onClick={() => markResold(o)} title={!toBool(o.misprint) ? 'Eerst als misdruk' : (toBool(o.resold) ? 'Al doorverkocht' : 'Markeer doorverkocht')}>🔄 Doorverkocht</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </RequireAdmin>
  )
}
