export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import OrdersView from '@/components/OrdersView'
import ClientErrorBoundary from '@/components/ClientErrorBoundary'

export default function AdminPage() {
  return (
    <ClientErrorBoundary>
      <OrdersView />
    </ClientErrorBoundary>
  )
}
