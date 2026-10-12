import {useState} from 'react'

type Order = 'before' | 'after'
const key = 'dsh-session-reasoning-order'

export function useReasoningOrder(sessionId: string) {
  const [orders, setOrders] = useState<Record<string, Order>>(() => {
    try {
      const data: unknown = JSON.parse(localStorage.getItem(key) || '{}')
      if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
      return Object.fromEntries(Object.entries(data).filter(([, value]) => value === 'before' || value === 'after'))
    } catch { return {} }
  })
  const setOrder = (order: Order) => {
    if (!sessionId) return
    const next = {...orders, [sessionId]: order}
    setOrders(next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* Still applies for this page lifetime. */ }
  }
  return [orders[sessionId] || 'after', setOrder] as const
}
