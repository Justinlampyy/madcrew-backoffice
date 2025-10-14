'use client'
import { Component, ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean; error?: any }

export default class ClientErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }
  static getDerivedStateFromError(error: any) { return { hasError: true, error } }
  componentDidCatch(error: any, info: any) { console.error('Client error:', error, info) }
  render() {
    if (this.state.hasError) {
      return (
        <div className="card">
          <div className="font-semibold mb-1">Er ging iets mis in de pagina</div>
          <div className="text-sm opacity-70 mb-2">Check de console voor details (F12 → Console).</div>
          <pre className="text-xs opacity-70 overflow-auto max-h-48">{String(this.state.error)}</pre>
        </div>
      )
    }
    return this.props.children
  }
}
