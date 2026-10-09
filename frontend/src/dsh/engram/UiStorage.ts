/**
 * UI 偏好持久化 hook：把任意 React state 同步到 localStorage，统一包名空间 dsh-engram.ui.*，
 * 隐私模式或存储失败时回退到默认值；非法值也降级默认。
 * 设计：包名空间 + key 后缀，避免与宿主/其它插件冲突。
 * @module @kenz1117/dsh-engram/client/UiStorage
 */

import { useCallback, useEffect, useState } from 'react'

/** 命名空间：所有 key 都加此前缀。 */
const NAMESPACE = 'dsh-engram.ui'

/** 防御性读：localStorage 抛错（隐私模式 / 禁用）返回 undefined。 */
function safeGet(key: string): string | undefined {
  try { return window.localStorage.getItem(key) ?? undefined } catch { return undefined }
}

/** 防御性写：失败静默（UI 状态本身不依赖写回成功）。 */
function safeSet(key: string, value: string): void {
  try { window.localStorage.setItem(key, value) } catch { /* 静默 */ }
}

/** 类型守卫：判断 raw 是否为合法值集合中的某一项。 */
function isValid<T>(raw: string | undefined, allow: readonly T[]): raw is string & T {
  if (raw === undefined) return false
  return (allow as readonly unknown[]).includes(raw)
}

/**
 * 持久化 state：与 useState 同语义，初值惰性从 localStorage 读取，变更时同步写回。
 * @param suffix - localStorage key 后缀（不含包名空间）。
 * @param fallback - 默认值（首次进入或读取失败时使用）。
 * @param allow - 合法值白名单；同时用于入参校验与持久化校验。
 */
export function usePersistedState<T extends string>(
  suffix: string,
  fallback: T,
  allow: readonly T[],
): [T, (next: T) => void] {
  const key = `${NAMESPACE}.${suffix}`
  const [value, setValue] = useState<T>(() => {
    const raw = safeGet(key)
    return isValid<T>(raw, allow) ? raw : fallback
  })
  useEffect(() => { safeSet(key, value) }, [key, value])
  const update = useCallback((next: T) => { setValue(next) }, [])
  return [value, update]
}

/** 任意字符串持久化：无 allow 白名单，q 这种自由输入适用。 */
export function usePersistedString(
  suffix: string,
  fallback: string,
): [string, (next: string) => void] {
  const key = `${NAMESPACE}.${suffix}`
  const [value, setValue] = useState<string>(() => safeGet(key) ?? fallback)
  useEffect(() => { safeSet(key, value) }, [key, value])
  const update = useCallback((next: string) => { setValue(next) }, [])
  return [value, update]
}