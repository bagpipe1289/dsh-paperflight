/**
 * 轻量 Toast：右上角叠层通知，3 秒自动消失，hover 暂停。
 * 4 种语义：info / success / error / warning（图标与配色由样式表决定，文案一律走调用方传入的字符串）。
 * confirm 不归本 hook 管——那是对话框决策，保留 window.confirm 以免破坏流程语义。
 * @module @kenz1117/dsh-engram/client/Toast
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './panel.module.css'

/** Toast 语义类型。 */
export type ToastKind = 'info' | 'success' | 'error' | 'warning'

/** 单条 Toast。 */
interface ToastItem {
  readonly id: number
  readonly kind: ToastKind
  readonly message: string
  readonly duration: number
}

const DEFAULT_DURATION: Record<ToastKind, number> = {
  info: 3000,
  success: 3000,
  warning: 5000,
  error: 5000,
}

/** 顺序自增 id 源（避免 useEffect 依赖 Date.now）。 */
let toastIdCursor = 0

/**
 * 把 toasts 数组渲染为右上角浮层。每帧返回新 ReactElement，调用方挂在面板根节点末尾。
 * hover 期间不消失（由 useToast 内部维护 timers 控制）。
 */
function ToastViewport({ items, onDismiss }: {
  readonly items: readonly ToastItem[]
  readonly onDismiss: (id: number) => void
}): React.ReactElement {
  return (
    <div className={styles.toastViewport} role="region" aria-live="polite" aria-label="notifications">
      {items.map(toast => {
        const kindClass = toast.kind === 'success' ? styles.toastSuccess
          : toast.kind === 'error' ? styles.toastError
          : toast.kind === 'warning' ? styles.toastWarning
          : styles.toastInfo
        return (
          <div key={toast.id}
            className={`${styles.toast} ${kindClass}`}
            role={toast.kind === 'error' || toast.kind === 'warning' ? 'alert' : 'status'}>
            <span className={styles.toastBody}>{toast.message}</span>
            <button type="button" className={styles.toastDismiss} aria-label="dismiss"
              onClick={() => { onDismiss(toast.id) }}>×</button>
          </div>
        )
      })}
    </div>
  )
}

/** Toast hook 返回：toasts 列表 + push 函数 + 渲染节点。 */
export interface ToastController {
  readonly toasts: readonly ToastItem[]
  readonly push: (kind: ToastKind, message: string, duration?: number) => void
  readonly dismiss: (id: number) => void
  readonly viewport: React.ReactElement
}

export function useToast(): ToastController {
  const [toasts, setToasts] = useState<readonly ToastItem[]>([])
  // 计时器表：id → setTimeout handle，方便 dismiss 取消。
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: number) => {
    setToasts(current => current.filter(toast => toast.id !== id))
    const timer = timersRef.current.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const push = useCallback((kind: ToastKind, message: string, duration?: number) => {
    toastIdCursor += 1
    const id = toastIdCursor
    const ms = duration ?? DEFAULT_DURATION[kind]
    const item: ToastItem = { id, kind, message, duration: ms }
    setToasts(current => [...current, item])
    const timer = setTimeout(() => { dismiss(id) }, ms)
    timersRef.current.set(id, timer)
  }, [dismiss])

  useEffect(() => () => {
    for (const timer of timersRef.current.values()) clearTimeout(timer)
    timersRef.current.clear()
  }, [])

  const viewport = (
    <ToastViewport items={toasts} onDismiss={dismiss} />
  )

  return { toasts, push, dismiss, viewport }
}