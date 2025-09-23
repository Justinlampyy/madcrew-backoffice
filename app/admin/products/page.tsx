'use client'
import RequireAdmin from '@/components/RequireAdmin'
import { db } from '@/lib/firebase'
import { addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'

type Product = { name: string; cost: number; price: number; margin: number }

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([])
  const [form, setForm] = useState<Product>({ name: '', cost: 0, price: 0, margin: 5 })

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  const add = async () => {
    await addDoc(collection(db, 'products'), form)
    setForm({ name: '', cost: 0, price: 0, margin: 5 })
  }

  return (
    <RequireAdmin>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="font-semibold mb-2">Nieuw product</h2>
          <div className="grid gap-2">
            <input className="input" placeholder="Naam" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Inkoop (drukker)" type="number" value={form.cost} onChange={e => setForm({ ...form, cost: Number(e.target.value) })} />
            <input className="input" placeholder="Verkoop (standaard)" type="number" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} />
            <input className="input" placeholder="Marge/buffer standaard" type="number" value={form.margin} onChange={e => setForm({ ...form, margin: Number(e.target.value) })} />
            <button className="btn" onClick={add}>Toevoegen</button>
          </div>
        </div>
        <div className="card">
          <h2 className="font-semibold mb-2">Producten</h2>
          <table className="table">
            <thead><tr><th>Naam</th><th>Inkoop</th><th>Verkoop</th><th>Marge</th><th></th></tr></thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>€ {Number(p.cost||0).toFixed(2)}</td>
                  <td>€ {Number(p.price||0).toFixed(2)}</td>
                  <td>€ {Number(p.margin||0).toFixed(2)}</td>
                  <td><button className="btn" onClick={async () => { await deleteDoc(doc(db,'products',p.id))}}>Verwijder</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </RequireAdmin>
  )
}
