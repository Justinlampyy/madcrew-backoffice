export const dynamic = 'force-dynamic'
'use client'
import OrdersView from '@/components/OrdersView'

export default function AdminDashboard() {
  // Volledig dashboard = OrdersView (bevat KPI’s + nieuw-bestelling + tabel)
  return <OrdersView />
}