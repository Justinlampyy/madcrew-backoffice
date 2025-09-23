'use client'

import RequireAdmin from '@/components/RequireAdmin'
import { db } from '@/lib/firebase'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { jsPDF } from 'jspdf'

type Order = {
  date?: string
  customer?: string
  product?: string
  color?: string
  size?: string
  qty?: number
  price?: number
  total?: number
  margin?: number
  roundId?: string
  seq?: number
}

function formatEuro(n: number) {
  return `€ ${n.toFixed(2)}`
}

export default function DrukkerOverzichtPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const roundId = params?.id
  const [roundName, setRoundName] = useState<string>('')
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!roundId) return
    (async () => {
      setLoading(true)
      const rref = doc(collection(db, 'rounds'), String(roundId))
      const rsnap = await getDoc(rref)
      setRoundName(rsnap.exists() ? (rsnap.data()?.name || '') : '')

      const qref = query(collection(db, 'orders'), where('roundId', '==', String(roundId)))
      const osnap = await getDocs(qref)
      setOrders(osnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })()
  }, [roundId])

  // Sorteer binnen ronde op seq; anders op datum
  const ordersSorted = useMemo(() => {
    const arr = [...orders]
    if (arr.some((o: any) => typeof o.seq === 'number')) {
      arr.sort((a: any, b: any) => (a.seq ?? 0) - (b.seq ?? 0))
    } else {
      arr.sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)))
    }
    return arr
  }, [orders])

  const rows = useMemo(() => {
    return ordersSorted.map((o: Order) => {
      const qty = Number(o.qty || 0)
      const total = Number(o.total || 0)
      const margin = Number(o.margin || 0)
      const costTotal = Math.max(0, total - margin)
      const unitCost = qty > 0 ? costTotal / qty : 0
      return {
        customer: o.customer || '',
        product: o.product || '',
        color: o.color || '',
        size: o.size || '',
        qty,
        unitCost,
        costTotal,
      }
    })
  }, [ordersSorted])

  const grandTotal = rows.reduce((acc, r) => acc + r.costTotal, 0)

  function downloadPdf() {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const margin = 40
    let y = margin

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    const title = `Productieoverzicht – ${roundName || 'Bestelronde'}`
    doc.text(title, margin, y)
    y += 22

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Dit overzicht bevat alleen inkoop-/drukkerprijzen (geen marges of interne informatie).', margin, y)
    y += 18

    const headers = ['Naam klant', 'Product', 'Kleur', 'Maat', 'Aantal', 'Prijs/stuk', 'Totaal']
    const colWidths = [140, 120, 70, 50, 50, 70, 70]
    const startX = margin
    const headerY = y

    doc.setFont('helvetica', 'bold')
    headers.forEach((h, i) => {
      const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0)
      doc.text(h, x, headerY)
    })
    y += 14
    doc.setFont('helvetica', 'normal')

    const lineHeight = 16
    const maxY = doc.internal.pageSize.getHeight() - margin - 60

    rows.forEach((r) => {
      if (y > maxY) {
        doc.addPage()
        y = margin
        doc.setFont('helvetica', 'bold')
        headers.forEach((h, i) => {
          const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0)
          doc.text(h, x, y)
        })
        doc.setFont('helvetica', 'normal')
        y += 14
      }

      const cols = [
        r.customer,
        r.product,
        r.color,
        r.size,
        String(r.qty),
        formatEuro(r.unitCost),
        formatEuro(r.costTotal),
      ]
      cols.forEach((c, i) => {
        const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0)
        const maxChars = Math.floor(colWidths[i] / 6.2)
        const val = c.length > maxChars ? c.slice(0, maxChars - 1) + '…' : c
        doc.text(val, x, y)
      })
      y += lineHeight
    })

    if (y > maxY) {
      doc.addPage()
      y = margin
    }
    y += 10
    doc.setFont('helvetica', 'bold')
    doc.text(`Totaal af te dragen aan drukker: ${formatEuro(grandTotal)}`, margin, y)

    doc.save(`Productieoverzicht_${(roundName || 'bestelronde').replace(/\s+/g, '_')}.pdf`)
  }

  return (
    <RequireAdmin>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">Productieoverzicht</h1>
          <div className="opacity-70 text-sm">
            {roundName ? `Bestelronde: ${roundName}` : 'Bestelronde'}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={() => router.push('/admin/rounds')}>← Terug</button>
          <button className="btn" onClick={downloadPdf}>Download PDF</button>
        </div>
      </div>

      <div className="card overflow-auto">
        {loading ? (
          <div>Gegevens laden…</div>
        ) : rows.length === 0 ? (
          <div>Geen orders gevonden voor deze ronde.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Naam klant</th>
                <th>Product</th>
                <th>Kleur</th>
                <th>Maat</th>
                <th>Aantal</th>
                <th>Prijs/stuk</th>
                <th>Totaal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx}>
                  <td>{r.customer}</td>
                  <td>{r.product}</td>
                  <td>{r.color}</td>
                  <td>{r.size}</td>
                  <td>{r.qty}</td>
                  <td>{formatEuro(r.unitCost)}</td>
                  <td>{formatEuro(r.costTotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} className="text-right font-semibold">Totaal af te dragen aan drukker:</td>
                <td className="font-semibold">{formatEuro(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </RequireAdmin>
  )
}
