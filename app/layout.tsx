import './globals.css'
import Link from 'next/link'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>
        <header className="border-b border-neutral-200 dark:border-neutral-800">
          <div className="container py-3 flex items-center justify-between">
            <Link href="/" className="font-semibold">MadCrew Backoffice</Link>
            <nav className="flex gap-3 text-sm">
              <Link href="/admin">Dashboard</Link>
              <Link href="/admin/orders">Bestellingen</Link>
              <Link href="/admin/rounds">Bestelrondes</Link>
              <Link href="/admin/products">Producten</Link>
              <Link href="/admin/import">Import</Link>
            </nav>
          </div>
        </header>
        <main className="container py-6">{children}</main>
      </body>
    </html>
  )
}
