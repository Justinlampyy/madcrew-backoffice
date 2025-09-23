'use client'
import * as XLSX from 'xlsx'
import RequireAdmin from '@/components/RequireAdmin'
import { db } from '@/lib/firebase'
import {
  addDoc,
  collection,
  deleteDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore'
import { useState } from 'react'

// Helpers
function ymd(d: Date) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDateCell(v: any): string {
  if (v instanceof Date) {
    return ymd(new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())))
  }
  if (typeof v === 'number') {
    const SSF: any = (XLSX as any).SSF
    if (SSF && typeof SSF.parse_date_code === 'function') {
      const parsed = SSF.parse_date_code(v)
      if (parsed && parsed.y && parsed.m && parsed.d) {
        return ymd(new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)))
      }
    }
    const excelEpoch = Date.UTC(1899, 11, 30) // 1899-12-30
    const ms = excelEpoch + v * 86400000
    return ymd(new Date(ms))
  }
  if (typeof v === 'string') {
    const s = v.trim()
    if (/bestelronde/i.test(s)) return s
    const m1 = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/)
    if (m1) {
      let [, d, m, y] = m1
      let year = Number(y.length === 2 ? ('20' + y) : y)
      const date = new Date(Date.UTC(year, Number(m) - 1, Number(d)))
      return ymd(date)
    }
    return s
  }
  return ''
}

function toNumber(n: any, def = 0): number {
  const v = Number(n)
  return Number.isFinite(v) ? v : def
}

export default function ImportPage() {
  const [log, setLog] = useState<string[]>([])
  const [wipeFirst, setWipeFirst] = useState(false)
  const push = (m: string) => setLog(prev => [...prev, m])

  async function ensureRound(name: string) {
    const qref = query(collection(db, 'rounds'), where('name', '==', name))
    const snap = await getDocs(qref)
    if (!snap.empty) return snap.docs[0].id
    const ref = await addDoc(collection(db, 'rounds'), { name, status: 'closed', createdAt: new Date() })
    return ref.id
  }

  async function clearOrdersIfRequested() {
    if (!wipeFirst) return
    if (!window.confirm('Weet je zeker dat je ALLE bestaande orders wilt verwijderen?')) return
    push('Verwijderen van alle bestaande orders gestart…')
    const snap = await getDocs(collection(db, 'orders'))
    let i = 0
    for (const d of snap.docs) {
      await deleteDoc(d.ref)
      i++
      if (i % 50 === 0) push(`- ${i} orders verwijderd…`)
    }
    push(`Klaar: ${i} orders verwijderd.`)
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return

    await clearOrdersIfRequested()

    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array', cellDates: true })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: null })

    let currentRound = ''
    let currentRoundId = ''
    let seqCounter = 0

    for (const r of rows) {
      const rawDatum = r['Datum']

      if (typeof rawDatum === 'string' && /bestelronde/i.test(rawDatum)) {
        currentRound = rawDatum.trim()
        currentRoundId = await ensureRound(currentRound)
        seqCounter = 0 // reset per ronde
        push(`Ronde gedetecteerd: ${currentRound}`)
        continue
      }

      if (!rawDatum) continue

      const dateStr = parseDateCell(rawDatum)

      const qty = toNumber(r['Aantal'], 1)
      const price = toNumber(r['Prijs'], 0)
      const total = toNumber(r['Totaal'], qty * price)
      const margin = toNumber(r['Winst'], 0)

      seqCounter += 1

      const order = {
        date: dateStr,
        customer: r['Naam'] || '',
        product: r['Product'] || '',
        color: r['Kleur'] || '',
        size: r['Maat'] || '',
        qty,
        price,
        total,
        paid: r['Betaald (Ja/Nee)'] ?? '',
        notes: r['Opmerkingen'] || '',
        sentToPrinter: r['Naar drukker'] ?? '',
        misprint: !!r['Mis Druk'],
        margin,
        roundId: currentRoundId || null,
        seq: seqCounter, // volgorde zoals in Excel
      }

      await addDoc(collection(db, 'orders'), order)
    }

    push('Import voltooid. Datums herkend en volgorde (seq) gezet volgens Excel.')
  }

  return (
    <RequireAdmin>
      <div className="card mb-4">
        <h2 className="font-semibold mb-2">Excel importeren</h2>
        <p className="mb-3 text-sm opacity-80">
          Upload je <em>Verkoopoverzicht</em> Excel. Rijen met <strong>“Bestelronde …”</strong> in de kolom <strong>Datum</strong> worden als ronde-header herkend.
        </p>

        <label className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={wipeFirst}
            onChange={(e) => setWipeFirst(e.target.checked)}
          />
          <span className="text-sm">Eerst alle bestaande orders verwijderen (handig bij her-import)</span>
        </label>

        <input type="file" accept=".xlsx,.xls" onChange={onFile} className="mb-3" />

        <div className="text-sm whitespace-pre-wrap">{log.join('\n')}</div>
      </div>
    </RequireAdmin>
  )
}
