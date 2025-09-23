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
  // nieuw:
  misprint?: boolean
  misprint_qty?: number
  resold?: boolean
  resold_qty?: number
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
function todayYMD() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth()+1).padStart(2,'0')
  const dd = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${dd}`
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

  const unitCostOf = (o: Order) => {
    const total = Number(o.total || 0)
    const margin = Number(o.margin || 0)
    const qty = Number(o.qty || 0)
    const costTotal = Math.max(0, total - margin)
    return qty > 0 ? costTotal / qty : 0
  }
  const costTotals = (o: Order) => {
    const unit = unitCostOf(o)
    const qty = Number(o.qty || 0)
    return { unitCost: unit, costTotal: unit * qty }
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

  // === Status toggles ===
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

  // === Nieuw: misdruk per stuk toevoegen ===
  async function addMisprintQty(o: Order) {
    if (!o.id) return
    const unit = unitCostOf(o)
    const input = window.prompt(`Aantal misdrukken toevoegen voor ${o.product} (${o.size}):\nKostprijs/stuk: ${euro(unit)}\nVul een getal in (min 1).`, '1')
    if (!input) return
    const qty = Math.max(1, Math.floor(Number(input)))
    if (!Number.isFinite(qty)) return

    const prev = Number(o.misprint_qty || 0)
    const next = prev + qty
    const amount = - unit * qty

    await updateDoc(doc(db,'orders', o.id), { misprint: true, misprint_qty: next })
    await addBufferTx(o, 'misprint', amount, `Misdruk +${qty} → buffer ${euro(amount)}`)
    await auditLog(o.id, o.roundId, 'misprint_add', `Misdruk +${qty}`, { misprint_qty: { from: prev, to: next }, buffer_delta: amount })
  }

  // === Nieuw: doorverkoop registreren ===
  async function addResale(o: Order) {
    if (!o.id) return
    const available = Number(o.misprint_qty || 0) - Number(o.resold_qty || 0)
    if (available <= 0) { alert('Geen misdruk-voorraad meer om te verkopen.'); return }

    const qtyStr = window.prompt(`Hoeveel misdruk-stuks doorverkopen? (beschikbaar: ${available})`, '1')
    if (!qtyStr) return
    const qty = Math.max(1, Math.min(available, Math.floor(Number(qtyStr))))
    if (!Number.isFinite(qty)) return

    const buyer = (window.prompt('Naam koper (optioneel):', '') || '').trim()
    const priceStr = window.prompt('Verkoopbedrag per stuk (€):', '')
    const price = Number(priceStr)
    if (!price || !Number.isFinite(price) || price <= 0) { alert('Ongeldig bedrag.'); return }
    const total = price * qty

    // schrijf resale-record
    await addDoc(collection(db,'resales'), {
      orderId: o.id,
      roundId: o.roundId || null,
      date: todayYMD(),
      buyer: buyer || null,
      qty,
      pricePerUnit: price,
      totalAmount: total,
      note: null,
      createdAt: serverTimestamp(),
    })

    const prev = Number(o.resold_qty || 0)
    const next = prev + qty

    await updateDoc(doc(db,'orders', o.id), { resold: true, resold_qty: next })
    await addBufferTx(o, 'resold', total, `Doorverkoop ${qty} stuks${buyer ? ' aan ' + buyer : ''} → +${euro(total)}`)
    await auditLog(o.id, o.roundId, 'resale_add', `Doorverkoop ${qty}× á ${euro(price)} = ${euro(total)}`, { resold_qty: { from: prev, to: next }, resale: { buyer, qty, price, total } })
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
              <th>Misdruk (qty)</th>
              <th>Doorverkocht (qty)</th>
              <th>Voorraad misdruk</th>
              <th>Acties</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(o => {
              const { unitCost, costTotal } = costTotals(o)
              const misq = Number(o.misprint_qty || 0)
              const resq = Number(o.resold_qty || 0)
              const stock = Math.max(0, misq - resq)
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

                  <td>{misq}</td>
                  <td>{resq}</td>
                  <td>{stock}</td>

                  <td className="whitespace-nowrap">
                    <div className="flex flex-wrap gap-2">
                      <button className="btn" onClick={() => addMisprintQty(o)}>⚠️ Misdruk +</button>
                      <button className="btn" disabled={stock <= 0} onClick={() => addResale(o)} title={stock<=0?'Geen misdruk-voorraad':''}>🔄 Doorverkoop +</button>
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
