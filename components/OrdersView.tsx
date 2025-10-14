'use client'
import { db } from '@/lib/firebase'
import RequireAdmin from '@/components/RequireAdmin'
import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where
} from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'

type Product = { id: string; name: string; cost: number; price: number; margin: number }
type Round = { id: string; name?: string; status?: string }
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

export default function OrdersView() {
  const [orders, setOrders] = useState<Order[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [roundFilter, setRoundFilter] = useState<string>('all')
  const [bufferTx, setBufferTx] = useState<any[]>([])

  // Form nieuwe bestelling
  const [form, setForm] = useState({
    roundId: '',
    date: todayYMD(),
    customer: '',
    productId: '',
    productName: '',
    color: '',
    size: '',
    qty: 1,
    price: 0,
    marginPerUnit: 5,
    isAdminOrder: false,
  })

  // Edit modal state
  const [editing, setEditing] = useState<Order|null>(null)
  const [editForm, setEditForm] = useState({
    date: todayYMD(),
    customer: '',
    product: '',
    color: '',
    size: '',
    qty: 1,
    price: 0,
    marginTotal: 0,
    adminZeroMargin: false,
  })

  // ---- subscriptions
  useEffect(() => {
    const unsubR = onSnapshot(collection(db,'rounds'), snap => {
      const rs = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
      setRounds(rs)
      if (!form.roundId && rs.length) setForm(f => ({ ...f, roundId: rs[0].id }))
    })
    const unsubP = onSnapshot(collection(db,'products'), snap => {
      const ps = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Product[]
      setProducts(ps)
    })
    const unsubO = onSnapshot(collection(db,'orders'), (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Order)))
    })
    return () => { unsubR(); unsubP(); unsubO() }
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

  // ---- data views
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

  // KPI’s voor huidig filter
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

  // Mini-samenvatting per ronde (grid)
  const roundCards = useMemo(() => {
    const byRound = new Map<string, { name: string; omzet: number; margin: number; count: number }>()
    const roundName = (id: string) => rounds.find(r => r.id === id)?.name || id
    for (const o of orders) {
      const id = o.roundId || '—'
      const entry = byRound.get(id) || { name: roundName(id), omzet: 0, margin: 0, count: 0 }
      entry.omzet += Number(o.total || 0)
      entry.margin += Number(o.margin || 0)
      entry.count += 1
      byRound.set(id, entry)
    }
    // toon eerst open rondes (status==='open'), dan andere; sorteer op naam
    const enriched = Array.from(byRound.entries()).map(([id, v]) => ({ id, ...v, status: rounds.find(r => r.id===id)?.status || '' }))
    return enriched.sort((a,b) => {
      if (a.status === 'open' && b.status !== 'open') return -1
      if (a.status !== 'open' && b.status === 'open') return 1
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [orders, rounds])

  // helpers
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

  // audit + buffer
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

  // status toggles
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

  // misdruk / doorverkoop
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

  // nieuwe bestelling helpers
  function onSelectProduct(id: string) {
    const p = products.find(x => x.id === id)
    if (!p) {
      setForm(f => ({ ...f, productId: '', productName: '', price: 0, marginPerUnit: f.isAdminOrder ? 0 : 5 }))
      return
    }
    setForm(f => ({
      ...f,
      productId: id,
      productName: p.name,
      price: Number(p.price || 0),
      marginPerUnit: f.isAdminOrder ? 0 : Number(p.margin ?? 5)
    }))
  }
  function onToggleAdminOrder(v: boolean) {
    setForm(f => ({
      ...f,
      isAdminOrder: v,
      marginPerUnit: v ? 0 : (f.productId ? (products.find(x => x.id === f.productId)?.margin ?? 5) : f.marginPerUnit || 5)
    }))
  }
  async function nextSeqForRound(roundId: string) {
    const qref = query(collection(db,'orders'), where('roundId','==', roundId))
    const snap = await getDocs(qref)
    let maxSeq = 0
    snap.forEach(d => { const s = Number((d.data() as any).seq || 0); if (s > maxSeq) maxSeq = s })
    return maxSeq + 1
  }
  async function submitNewOrder(e: React.FormEvent) {
    e.preventDefault()
    if (!form.roundId) return alert('Kies een bestelronde.')
    if (!form.customer.trim()) return alert('Vul klantnaam in.')
    const productName = form.productName.trim()
    if (!productName) return alert('Kies of vul een productnaam in.')

    const qty = Math.max(1, Number(form.qty || 1))
    const price = Number(form.price || 0)
    const marginPerUnit = Number(form.marginPerUnit || 0)
    const marginTotal = (form.isAdminOrder ? 0 : marginPerUnit) * qty
    const total = price * qty

    const seq = await nextSeqForRound(form.roundId)

    const order: any = {
      date: form.date || todayYMD(),
      customer: form.customer.trim(),
      product: productName,
      color: form.color.trim(),
      size: form.size.trim(),
      qty,
      price,
      total,
      paid: false,
      sentToPrinter: false,
      delivered: false,
      misprint: false,
      misprint_qty: 0,
      resold: false,
      resold_qty: 0,
      margin: marginTotal,
      roundId: form.roundId,
      seq,
    }

    const ref = await addDoc(collection(db,'orders'), order)
    await auditLog(ref.id, form.roundId, 'order_create', 'Handmatig aangemaakt', { order })

    setForm(f => ({
      ...f,
      date: todayYMD(),
      customer: '',
      productId: '',
      productName: '',
      color: '',
      size: '',
      qty: 1,
      price: 0,
      marginPerUnit: f.isAdminOrder ? 0 : 5,
    }))
    alert('Bestelling toegevoegd.')
  }

  // ---- Edit/Delete ----
  function openEdit(o: Order) {
    setEditing(o)
    setEditForm({
      date: String(o.date || todayYMD()),
      customer: String(o.customer || ''),
      product: String(o.product || ''),
      color: String(o.color || ''),
      size: String(o.size || ''),
      qty: Number(o.qty || 1),
      price: Number(o.price || 0),
      marginTotal: Number(o.margin || 0),
      adminZeroMargin: Number(o.margin || 0) === 0,
    })
  }
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing?.id) return
    const qty = Math.max(1, Number(editForm.qty || 1))
    const price = Number(editForm.price || 0)
    const marginTotal = editForm.adminZeroMargin ? 0 : Number(editForm.marginTotal || 0)
    const total = price * qty

    const delta = {
      date: editForm.date,
      customer: editForm.customer.trim(),
      product: editForm.product.trim(),
      color: editForm.color.trim(),
      size: editForm.size.trim(),
      qty,
      price,
      total,
      margin: marginTotal,
    }
    await updateDoc(doc(db,'orders', editing.id), delta)
    await auditLog(editing.id, editing.roundId, 'order_edit', 'Handmatig aangepast', { delta })
    setEditing(null)
  }
  async function deleteOrder(o: Order) {
    if (!o.id) return
    if (!confirm('Weet je zeker dat je deze bestelling wilt verwijderen? Gekoppelde buffer-transacties en doorverkopen worden ook verwijderd.')) return

    // verwijder gekoppelde buffer_tx en resales
    const txQ = query(collection(db,'buffer_tx'), where('orderId','==', o.id))
    const txSnap = await getDocs(txQ)
    for (const d of txSnap.docs) await deleteDoc(d.ref)

    const rsQ = query(collection(db,'resales'), where('orderId','==', o.id))
    const rsSnap = await getDocs(rsQ)
    for (const d of rsSnap.docs) await deleteDoc(d.ref)

    await deleteDoc(doc(db,'orders', o.id))
    await auditLog(o.id, o.roundId, 'order_delete', 'Bestelling + gekoppelde transacties verwijderd', null)
  }

  return (
    <RequireAdmin>
      {/* Ronde samenvatting (mini-cards) */}
      <div className="grid gap-3 md:grid-cols-3 mb-4">
        {roundCards.map(rc => (
          <div key={rc.id} className="card">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{rc.name}</div>
                <div className="text-xs opacity-60">{rc.status === 'open' ? 'Open' : (rc.status || 'Ronde')}</div>
              </div>
              <button className="btn text-xs" onClick={()=>setRoundFilter(rc.id)}>Filter</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              <span className="badge">Bestellingen: {rc.count}</span>
              <span className="badge">Omzet: {euro(rc.omzet)}</span>
              <span className="badge">Marge: {euro(rc.margin)}</span>
              <span className="badge">Kosten drukker: {euro(Math.max(0, rc.omzet - rc.margin))}</span>
            </div>
          </div>
        ))}
      </div>

      {/* KPI's voor huidig filter */}
      <div className="card mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <select className="select w-auto" value={roundFilter} onChange={e => setRoundFilter(e.target.value)}>
            <option value="all">Alle rondes</option>
            {rounds.map(r => <option key={r.id} value={r.id}>{r.name || r.id}</option>)}
          </select>
          <div className="badge">Totaal omzet: {euro(kpis.omzet)}</div>
          <div className="badge">Buffer (marges + transacties): {euro(kpis.buffer)}</div>
          <div className="badge">Waarvan marges: {euro(kpis.margin)}</div>
          <div className="badge">Transacties buffer (som): {euro(kpis.tx)}</div>
          <div className="badge">Kosten drukker (geschat): {euro(kpis.kosten_drukker)}</div>
        </div>
      </div>

      {/* Nieuwe bestelling */}
      <div className="card mb-4">
        <h2 className="font-semibold mb-3">Nieuwe bestelling</h2>
        <form className="grid md:grid-cols-4 gap-3 items-end" onSubmit={submitNewOrder}>
          <div>
            <label className="text-sm opacity-70">Bestelronde</label>
            <select className="select" value={form.roundId} onChange={e=>setForm(f=>({...f, roundId: e.target.value}))}>
              <option value="">Kies ronde…</option>
              {rounds.map(r => <option key={r.id} value={r.id}>{r.name || r.id}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm opacity-70">Datum</label>
            <input className="input" type="date" value={form.date} onChange={e=>setForm(f=>({...f, date: e.target.value}))}/>
          </div>
          <div>
            <label className="text-sm opacity-70">Klantnaam</label>
            <input className="input" value={form.customer} onChange={e=>setForm(f=>({...f, customer: e.target.value}))}/>
          </div>
          <div>
            <label className="text-sm opacity-70">Product (kies om te vullen)</label>
            <select className="select" value={form.productId} onChange={e=>onSelectProduct(e.target.value)}>
              <option value="">— selecteer product —</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm opacity-70">Productnaam (vrij invulbaar)</label>
            <input className="input" placeholder="Bijv. Hoodie" value={form.productName} onChange={e=>setForm(f=>({...f, productName: e.target.value}))}/>
          </div>
          <div>
            <label className="text-sm opacity-70">Kleur</label>
            <input className="input" value={form.color} onChange={e=>setForm(f=>({...f, color: e.target.value}))}/>
          </div>
          <div>
            <label className="text-sm opacity-70">Maat</label>
            <input className="input" value={form.size} onChange={e=>setForm(f=>({...f, size: e.target.value}))}/>
          </div>
          <div>
            <label className="text-sm opacity-70">Aantal</label>
            <input className="input" type="number" min={1} value={form.qty} onChange={e=>setForm(f=>({...f, qty: Number(e.target.value||1)}))}/>
          </div>
          <div>
            <label className="text-sm opacity-70">Prijs/stuk (€)</label>
            <input className="input" type="number" step="0.01" value={form.price} onChange={e=>setForm(f=>({...f, price: Number(e.target.value||0)}))}/>
          </div>
          <div>
            <label className="text-sm opacity-70">Marge/buffer per stuk (€)</label>
            <input className="input" type="number" step="0.01" value={form.marginPerUnit} disabled={form.isAdminOrder} onChange={e=>setForm(f=>({...f, marginPerUnit: Number(e.target.value||0)}))}/>
          </div>
          <div className="flex items-center gap-2">
            <input id="adminOrder" type="checkbox" checked={form.isAdminOrder} onChange={e=>onToggleAdminOrder(e.target.checked)}/>
            <label htmlFor="adminOrder" className="text-sm">Beheerder-order (marge = €0)</label>
          </div>
          <div className="md:col-span-4">
            <button className="btn" type="submit">Toevoegen</button>
          </div>
        </form>
      </div>

      {/* Orders tabel */}
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
              const total = Number(o.total || 0)
              const margin = Number(o.margin || 0)
              const qty = Number(o.qty || 0)
              const unitCost = qty > 0 ? Math.max(0, total - margin) / qty : 0
              const costTotal = unitCost * qty
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
                  <td>{euro(total)}</td>
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
                      <button className="btn" onClick={() => openEdit(o)}>✏️ Bewerken</button>
                      <button className="btn" onClick={() => addMisprintQty(o)}>⚠️ Misdruk +</button>
                      <button className="btn" disabled={stock <= 0} onClick={() => addResale(o)} title={stock<=0?'Geen misdruk-voorraad':''}>🔄 Doorverkoop +</button>
                      <button className="btn" onClick={() => deleteOrder(o)}>🗑 Verwijderen</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 w-[680px] max-w-[95vw] shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Bestelling bewerken</h3>
              <button className="btn" onClick={()=>setEditing(null)}>✖</button>
            </div>
            <form className="grid md:grid-cols-3 gap-3" onSubmit={saveEdit}>
              <div>
                <label className="text-sm opacity-70">Datum</label>
                <input className="input" type="date" value={editForm.date} onChange={e=>setEditForm(f=>({...f, date: e.target.value}))}/>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm opacity-70">Klantnaam</label>
                <input className="input" value={editForm.customer} onChange={e=>setEditForm(f=>({...f, customer: e.target.value}))}/>
              </div>
              <div className="md:col-span-3">
                <label className="text-sm opacity-70">Product</label>
                <input className="input" value={editForm.product} onChange={e=>setEditForm(f=>({...f, product: e.target.value}))}/>
              </div>
              <div>
                <label className="text-sm opacity-70">Kleur</label>
                <input className="input" value={editForm.color} onChange={e=>setEditForm(f=>({...f, color: e.target.value}))}/>
              </div>
              <div>
                <label className="text-sm opacity-70">Maat</label>
                <input className="input" value={editForm.size} onChange={e=>setEditForm(f=>({...f, size: e.target.value}))}/>
              </div>
              <div>
                <label className="text-sm opacity-70">Aantal</label>
                <input className="input" type="number" min={1} value={editForm.qty} onChange={e=>setEditForm(f=>({...f, qty: Number(e.target.value||1)}))}/>
              </div>
              <div>
                <label className="text-sm opacity-70">Prijs/stuk (€)</label>
                <input className="input" type="number" step="0.01" value={editForm.price} onChange={e=>setEditForm(f=>({...f, price: Number(e.target.value||0)}))}/>
              </div>
              <div>
                <label className="text-sm opacity-70">Marge totaal (€)</label>
                <input className="input" type="number" step="0.01" disabled={editForm.adminZeroMargin} value={editForm.marginTotal} onChange={e=>setEditForm(f=>({...f, marginTotal: Number(e.target.value||0)}))}/>
                <label className="flex items-center gap-2 mt-2 text-sm">
                  <input type="checkbox" checked={editForm.adminZeroMargin} onChange={e=>setEditForm(f=>({...f, adminZeroMargin: e.target.checked}))}/>
                  Marge op 0 zetten (beheerder-order)
                </label>
              </div>
              <div className="md:col-span-3 flex justify-end gap-2 mt-2">
                <button type="button" className="btn" onClick={()=>setEditing(null)}>Annuleren</button>
                <button type="submit" className="btn">Opslaan</button>
              </div>
            </form>
            <div className="mt-2 text-xs opacity-60">
              Tip: de bestelronde kan hier niet worden gewijzigd (behoudt volgorde/seq). Verwijder en voeg opnieuw toe als je van ronde wilt wisselen.
            </div>
          </div>
        </div>
      )}
    </RequireAdmin>
  )
}