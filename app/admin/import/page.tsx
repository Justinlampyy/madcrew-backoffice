'use client'
import * as XLSX from 'xlsx'
import RequireAdmin from '@/components/RequireAdmin'
import { db } from '@/lib/firebase'
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { useState } from 'react'

type Row = Record<string, any>

export default function ImportPage() {
  const [log, setLog] = useState<string[]>([])
  const push = (m: string) => setLog(prev => [...prev, m])

  async function ensureRound(name: string) {
    const q = query(collection(db,'rounds'), where('name','==',name))
    const snap = await getDocs(q)
    if (!snap.empty) return snap.docs[0].id
    const ref = await addDoc(collection(db,'rounds'), { name, status: 'closed', createdAt: new Date() })
    return ref.id
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows: Row[] = XLSX.utils.sheet_to_json(sheet, { defval: null })

    let currentRound = ''
    let currentRoundId = ''

    for (const r of rows) {
      const datum = r['Datum']
      // Ronde header row: "Bestelronde X"
      if (typeof datum === 'string' && datum.toLowerCase().includes('bestelronde')) {
        currentRound = datum.trim()
        currentRoundId = await ensureRound(currentRound)
        push(`Ronde gedetecteerd: ${currentRound}`)
        continue
      }
      if (!datum) continue

      const qty = Number(r['Aantal'] || 1)
      const price = Number(r['Prijs'] || 0)
      const total = Number(r['Totaal'] || (qty * price))
      const margin = Number(r['Winst'] || 0)

      const order = {
        date: typeof datum === 'string' ? datum : new Date(datum).toISOString().slice(0,10),
        customer: r['Naam'] || '',
        product: r['Product'] || '',
        color: r['Kleur'] || '',
        size: r['Maat'] || '',
        qty,
        price,
        total,
        paid: r['Betaald (Ja/Nee)'] || '',
        notes: r['Opmerkingen'] || '',
        sentToPrinter: r['Naar drukker'] || '',
        misprint: !!r['Mis Druk'],
        margin,
        roundId: currentRoundId || null
      }
      await addDoc(collection(db,'orders'), order)
    }
    push('Import voltooid.')
  }

  return (
    <RequireAdmin>
      <div className="card">
        <h2 className="font-semibold mb-2">Excel importeren</h2>
        <p className="mb-3 text-sm opacity-80">Upload je <em>Verkoopoverzicht</em> Excel. De tool herkent rijen zoals "Bestelronde X" en koppelt daarop.</p>
        <input type="file" accept=".xlsx,.xls" onChange={onFile} className="mb-3" />
        <div className="text-sm whitespace-pre-wrap">{log.join('\n')}</div>
      </div>
    </RequireAdmin>
  )
}
