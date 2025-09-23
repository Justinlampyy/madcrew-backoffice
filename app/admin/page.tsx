'use client'
import RequireAdmin from '@/components/RequireAdmin'
import { db } from '@/lib/firebase'
import { collection, getDocs } from 'firebase/firestore'
import { useEffect, useState } from 'react'

type Order = {
  total?: number
  margin?: number
  roundId?: string
  status?: string
}

export default function AdminDashboard() {
  const [kpis, setKpis] = useState({ omzet: 0, kosten: 0, buffer: 0, orders: 0 })

  useEffect(() => {
    (async () => {
      const ordersSnap = await getDocs(collection(db, 'orders'))
      let omzet = 0, kosten = 0, buffer = 0, orders = 0
      ordersSnap.forEach(doc => {
        const o = doc.data() as Order
        omzet += Number(o.total || 0)
        // kosten = inkoop = omzet - marge (bij 5 euro marge per item)
        buffer += Number(o.margin || 0)
        orders += 1
      })
      // kosten drukker = omzet - buffer (benadering)
      kosten = Math.max(0, omzet - buffer)
      setKpis({ omzet, kosten, buffer, orders })
    })()
  }, [])

  return (
    <RequireAdmin>
      <div className="grid md:grid-cols-4 gap-4">
        <div className="card"><div className="text-sm opacity-70">Totaal omzet</div><div className="kpi">€ {kpis.omzet.toFixed(2)}</div></div>
        <div className="card"><div className="text-sm opacity-70">Kosten drukker (geschat)</div><div className="kpi">€ {kpis.kosten.toFixed(2)}</div></div>
        <div className="card"><div className="text-sm opacity-70">Winstbuffer</div><div className="kpi">€ {kpis.buffer.toFixed(2)}</div></div>
        <div className="card"><div className="text-sm opacity-70"># Bestellingen</div><div className="kpi">{kpis.orders}</div></div>
      </div>
    </RequireAdmin>
  )
}
