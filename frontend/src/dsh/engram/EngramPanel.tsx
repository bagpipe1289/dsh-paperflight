/**
 * 记忆库设置面板：统计卡片、过滤列表、批量操作、编辑（取代链）、遗忘/恢复、导出。
 * 数据经回环 API（/api/dsh/engram/*）读写；详情与编辑为条目下方行内展开
 * （不嵌套弹窗）；文案全部走宿主 locale 词典（zh/en），语言切换自动
 * 重渲染；数据层英文枚举（status/kind/op）只在显示层映射；内容节点
 * 一律 DOM/JSX 构建（防 XSS）。
 * @module @kenz1117/dsh-engram/client/EngramPanel
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {confirmAction} from '../confirm'
type PropsLocale<_N>={t:(key:EngramKey,params?:Record<string,unknown>)=>string}
import styles from './panel.module.css'
import { KIND_KEY, NS, type EngramKey } from './locales.ts'
import { CorridorMap } from './CorridorMap.tsx'
import { useToast, type ToastController } from './Toast.tsx'
import { usePersistedState, usePersistedString } from './UiStorage.ts'

/** 列表/详情用的记忆视图（宿主 /api/dsh/engram/list 的行结构）。 */
interface MemoryRow {
  readonly id: string
  readonly scope: 'user' | 'project' | 'shared'
  readonly kind: string
  readonly content: string
  readonly importance: number
  readonly confidence: number
  readonly status: 'active' | 'archived' | 'forgotten'
  /** 最近一次使用效果回报（engram_report 写入；未回报过缺省）。 */
  readonly outcome?: 'success' | 'failure'
  readonly createdAt: number
  readonly accessCount: number
  readonly sourceSessionId: string | null
  readonly sourceRound: number | null
  /** 桩位（v0.7.2 起；未排桩时缺省）。 */
  readonly slot?: { readonly room: string; readonly index: number }
}

interface ListResult {
  readonly records: MemoryRow[]
  readonly total: number
}

interface StatsPart {
  readonly scope: 'user' | 'project' | 'shared'
  readonly stats: {
    readonly total: number
    readonly active: number
    readonly archived: number
    readonly forgotten: number
    readonly redacted: number
    readonly signalRatio: number
    /** 各房间（kind）条目数；stats 路由的 byKind 字段（房间目录数据源）。 */
    readonly byKind?: Readonly<Record<string, number>>
  }
}

/** review API 的返回结构（详情行内展开区的数据源）。 */
interface ReviewView {
  readonly record: MemoryRow
  readonly supersededBy?: readonly string[]
  readonly supersedes?: readonly string[]
  readonly contradicts?: readonly string[]
  readonly related?: readonly string[]
  /** 修订历史（旧内容快照，按被取代时间倒序）。 */
  readonly revisions?: readonly { content: string; kind: string; importance: number; supersededAt: number }[]
  readonly operations?: readonly { at: number; op: string; detail: string | null }[]
}

/** 面板内部传递的翻译函数（渲染器按注册的 locale 声明合成的 t 的窄化签名）。 */
type T = (key: EngramKey, params?: Record<string, unknown>) => string

/** kind 数据值（存储层英文枚举，编辑表单下拉的 value 保持英文）。 */
const KINDS = ['fact', 'preference', 'decision', 'episode', 'skill'] as const
const PAGE_SIZE = 20

/** 数据层枚举 → 词典键映射（显示层本地化，存储值不变）。 */
const STATUS_KEY: Record<MemoryRow['status'], EngramKey> = {
  active: 'statusActive',
  archived: 'statusArchived',
  forgotten: 'statusForgotten',
}
const SCOPE_KEY: Record<MemoryRow['scope'], EngramKey> = {
  user: 'scopeUser',
  project: 'scopeProject',
  shared: 'scopeShared',
}
/** 房间色相类（panel.module.css 的 .roomFact 等）；未知 kind 回退通用的 .kind。 */
const ROOM_CLASS: Record<string, string> = {
  fact: 'roomFact',
  preference: 'roomPreference',
  decision: 'roomDecision',
  episode: 'roomEpisode',
  skill: 'roomSkill',
}
const OP_KEY: Record<string, EngramKey> = {
  write: 'opWrite',
  'write-merge': 'opWriteMerge',
  update: 'opUpdate',
  forget: 'opForget',
  restore: 'opRestore',
  decay: 'opDecay',
  superseded: 'opSuperseded',
  'ingest-request': 'opIngestRequest',
  'ingest-done': 'opIngestDone',
  'outcome-report': 'opOutcomeReport',
  assess: 'opAssess',
  consolidation: 'opConsolidation',
  'review-answer': 'opReviewAnswer',
  'slot-assign': 'opSlotAssign',
  'slot-backfill': 'opSlotBackfill',
  'room-open': 'opRoomOpen',
  'search-rewrite-request': 'opSearchRewrite',
  'compress-request': 'opCompressRequest',
  'distill-request': 'opDistillRequest',
  'profile-edit': 'opProfileEdit',
}
const REL_KEY: Record<string, EngramKey> = {
  supersededBy: 'relSupersededBy',
  supersedes: 'relSupersedes',
  contradicts: 'relContradicts',
  related: 'relRelated',
}
/** 操作日志 detail JSON 的已知键 → 词典键（write/update/superseded 的小对象）。 */
const DETAIL_KEY: Record<string, EngramKey> = {
  kind: 'labelKind',
  scope: 'labelScope',
  status: 'labelStatus',
}

/** kind 数据值 → 本地化标签（未知值回退原文）。 */
function kindLabel(t: T, kind: string): string {
  const key = KIND_KEY[kind]
  return key === undefined ? kind : t(key)
}

/** 房间 pill 的类名：按 kind 取色相类，未知 kind 回退通用品牌色。 */
function roomPillClass(kind: string): string {
  return `${styles.pill} ${styles[ROOM_CLASS[kind] ?? 'kind'] ?? ''}`
}

/** op 数据值 → 本地化标签（未知值回退原文）。 */
function opLabel(t: T, op: string): string {
  const key = OP_KEY[op]
  return key === undefined ? op : t(key)
}

/** 操作日志 detail 的本地化：write/update/superseded 的小对象转中文键值；摄取/蒸馏请求的完整 JSON 保持原样（审计诚实性优先）。 */
function formatOpDetail(t: T, op: string, detail: string | null): string {
  if (detail === null) return ''
  // 画像修订的小对象转成语义句（创建/编辑/回滚三式，与工具的 audit detail 键对齐）。
  if (op === 'profile-edit') {
    try {
      const parsed = JSON.parse(detail) as { action?: unknown; fromVersion?: unknown; toVersion?: unknown; restoredFrom?: unknown; chars?: unknown }
      const to = Number(parsed.toVersion)
      const chars = Number(parsed.chars)
      if (parsed.action === 'edit' && parsed.fromVersion === null) {
        return ' ' + t('profileOpCreate', { to, chars })
      }
      const from = Number(parsed.fromVersion)
      if (parsed.action === 'edit') return ' ' + t('profileOpEdit', { from, to, chars })
      const restored = Number(parsed.restoredFrom)
      if (parsed.action === 'rollback' && Number.isInteger(from) && Number.isInteger(to) && Number.isInteger(restored)) {
        return ' ' + t('profileOpRollback', { from, to, restored, chars })
      }
    } catch {
      // detail 不是预期的 JSON：落到底部原样展示。
    }
    return ` ${detail}`
  }
  if (op !== 'write' && op !== 'update' && op !== 'superseded') return ` ${detail}`
  try {
    const parsed = JSON.parse(detail) as Record<string, unknown>
    const entries = Object.entries(parsed)
    if (entries.length === 0) return ` ${detail}`
    return ' ' + entries.map(([key, value]) => {
      const label = DETAIL_KEY[key]
      if (label === undefined) return `${key}=${String(value)}`
      if (key === 'kind' && typeof value === 'string') return `${t(label)}=${kindLabel(t, value)}`
      if (key === 'scope' && (value === 'user' || value === 'project')) return `${t(label)}=${t(SCOPE_KEY[value])}`
      return `${t(label)}=${String(value)}`
    }).join(' · ')
  } catch {
    return ` ${detail}`
  }
}

/** 来源会话展示片段：截短的会话 id + 可选轮次。 */
function sourceLabel(t: T, record: Pick<MemoryRow, 'sourceSessionId' | 'sourceRound'>): string {
  if (record.sourceSessionId === null) return t('sourceExplicit')
  const id = `${record.sourceSessionId.slice(0, 16)}…`
  const withRound = record.sourceRound === null
    ? id
    : `${id} ${t('round', { n: record.sourceRound })}`
  return t('sourceSession', { id: withRound })
}

/**
 * 当前项目宫殿的选择器（host 的项目分库 dbName）；null = 不注入，服务端走进程默认库。
 * 由 EngramSection 在**渲染期**赋值：父组件先于子组件渲染，保证子组件 effect 里的首批
 * 请求就带上选择器（放进 useEffect 会因「子 effect 先跑」而漏掉首帧那批请求）。
 */
let activeProjectSelector: string | null = null

/**
 * 固定的项目选择器失效时的自愈入口（host 回 404 unknown project）：
 * EngramSection 挂载时注册、卸载时清空——清掉固定的 library.project 回到 follow 并重载。
 */
let healDeadProject: (() => void) | null = null

/** 请求是否属于 project 作用域：URL 里的 scope=project，或 POST JSON body 的 scope === 'project'。 */
function isProjectScoped(path: string, init?: RequestInit): boolean {
  if (/(?:^|[?&])scope=project(?:&|$)/.test(path)) return true
  const body = init?.body
  if (typeof body !== 'string' || body === '') return false
  try {
    const parsed = JSON.parse(body) as { scope?: unknown } | null
    return typeof parsed === 'object' && parsed !== null && parsed.scope === 'project'
  } catch {
    // body 不是 JSON：按「非 project 作用域」处理，不抛错（偏好类请求可能带自由文本）。
    return false
  }
}

/** 往 JSON 对象 body 里加 project 字段；不可解析或非对象时返回 undefined（调用方退回 query 兜底）。 */
function withProjectField(body: string, selector: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as unknown
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
    return JSON.stringify({ ...(parsed as Record<string, unknown>), project: selector })
  } catch {
    return undefined
  }
}

/** 追加 project 查询参数（GET，以及无法改写 body 时的兜底路径）。 */
function withProjectParam(path: string, selector: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}project=${encodeURIComponent(selector)}`
}

/**
 * 唯一的请求出口：project 作用域的请求统一注入当前项目宫殿选择器。
 * POST 优先写进 JSON body（host 契约：POST 经 body 传选择器），body 不可解析时退回 query。
 * project 请求收到 404 unknown project 时触发一次自愈（清固定值回到 follow），随后照常抛错。
 * @param path - `/api/dsh/engram/` 之后的路径（含 query）；不要以 `/` 开头。
 * @param init - fetch 参数。
 * @param forceProject - 显式要求注入（合并视图如管家日志：user 侧照旧、project 侧跟随选择器）。
 * @returns 解析后的响应体；非 2xx 抛错（错误文案取 body.error）。
 */
async function api<T>(path: string, init?: RequestInit, forceProject = false): Promise<T> {
  const selector = activeProjectSelector
  let target = path
  let requestInit = init
  const projectScoped = selector !== null && (forceProject || isProjectScoped(path, init))
  if (projectScoped) {
    const body = init?.body
    const fromBody = typeof body === 'string' && body !== '' ? withProjectField(body, selector) : undefined
    if (fromBody !== undefined && init !== undefined) requestInit = { ...init, body: fromBody }
    else target = withProjectParam(path, selector)
  }
  const response = await fetch(`/api/dsh/engram/${target}`, requestInit)
  const parsed = (await response.json()) as T & { error?: string }
  if (!response.ok) {
    // 自愈：固定的分库已失效（工作区被删/改名）→ 回到跟随并重载，避免面板卡在错误态。
    if (projectScoped && response.status === 404 && parsed.error === 'unknown project') healDeadProject?.()
    throw new Error(parsed.error ?? `HTTP ${String(response.status)}`)
  }
  return parsed
}

/** host 项目宫殿清单的行（GET /api/dsh/engram/workspaces）。 */
interface EngramProjectItem {
  readonly dbName: string
  /** 工作区标题；host 给不出时为 null（显示回退路径末段 / dbName 短写）。 */
  readonly title?: string | null | undefined
  /** 该分库归属的工作目录；无法归属时 host 给 null 或直接省略该键。 */
  readonly path?: string | null | undefined
  /** workspace = 宿主注册表里的工作区；session = 只从会话 cwd 见到；process = 进程目录兜底。 */
  readonly kind: 'workspace' | 'session' | 'process'
  /** 项目标识来源（origin = git 仓库；cwd = 目录编码兜底）。 */
  readonly source: 'origin' | 'cwd'
  /** 宿主注册表里的工作区 id；对不上时 null（此时跟随只能按路径匹配）。 */
  readonly workspaceId?: string | null | undefined
  /** 库文件是否已存在（不存在时 memories 为 null）。 */
  readonly exists: boolean
  /** 库内记忆条数；库还不存在时为 null。 */
  readonly memories: number | null
}

/** GET /api/dsh/engram/workspaces 的返回（processDefault = 进程目录兜底库；缺席时 null）。 */
interface EngramWorkspacesView {
  readonly items: readonly EngramProjectItem[]
  readonly processDefault: { readonly dbName: string; readonly path: string | null; readonly title: string | null } | null
}

/** 宿主工作区视图（@deepseek-ai/dsh-api-workspace-controller/client 的 WorkspaceView 窄视图）。 */
export interface HostWorkspaceView {
  readonly workspaceId: string
  readonly path: string
  readonly title: string
  readonly sessionIds: readonly string[]
}

/** 宿主可观察快照的窄视图（getSnapshot + subscribe；与 useSyncExternalStore 兼容）。 */
interface ObservableLike<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

/** 宿主工作区服务窄视图（可选注入；缺席时面板其余功能照常）。 */
export interface WorkspacesLike {
  readonly list: ObservableLike<{ readonly items: readonly HostWorkspaceView[] }>
}

/** 宿主会话清单服务窄视图（可选注入；判定当前工作区只看当前会话 id）。 */
export interface SessionsLike {
  readonly list: ObservableLike<{ readonly current?: string | undefined }>
}

/** 空清单常量：useSyncExternalStore 的 getSnapshot 必须返回稳定引用。 */
const NO_WORKSPACES: readonly HostWorkspaceView[] = []

/** 服务缺席时的空订阅（保持 hook 调用形状一致）。 */
function noopUnsubscribe(): void { /* 无订阅可退 */ }

/**
 * 订阅宿主快照（useSyncExternalStore 的 subscribe 席位）。
 * 契约上返回退订函数；个别实现若返回 void，则退化为「不卸载」而不是抛错。
 */
function subscribeSnapshot<T>(source: ObservableLike<T> | undefined, onChange: () => void): () => void {
  if (source === undefined) return noopUnsubscribe
  const off = source.subscribe(onChange)
  return typeof off === 'function' ? off : noopUnsubscribe
}

/**
 * 当前 GUI 工作区：与侧边栏 WorkspacePicker 同一判定（工作区的 sessionIds 含当前会话）。
 * 两个宿主服务都可选：任一缺席时 available=false，chip 显示「无工作区信息（进程默认）」。
 * @param workspaces - 可选取用的宿主工作区服务。
 * @param sessions - 可选取用的宿主会话清单服务。
 * @returns 当前工作区（判定不出为 null）与服务是否齐备。
 */
function useCurrentWorkspace(workspaces: WorkspacesLike | undefined, sessions: SessionsLike | undefined): {
  workspace: HostWorkspaceView | null
  available: boolean
} {
  const subscribeWorkspaces = useCallback(
    (onChange: () => void): (() => void) => subscribeSnapshot(workspaces?.list, onChange),
    [workspaces],
  )
  const subscribeSessions = useCallback(
    (onChange: () => void): (() => void) => subscribeSnapshot(sessions?.list, onChange),
    [sessions],
  )
  const currentSessionId = useSyncExternalStore(subscribeSessions, () => sessions?.list.getSnapshot().current ?? null)
  const items = useSyncExternalStore(subscribeWorkspaces, () => workspaces?.list.getSnapshot().items ?? NO_WORKSPACES)
  const available = workspaces !== undefined && sessions !== undefined
  if (!available || currentSessionId === null) return { workspace: null, available }
  return { workspace: items.find(item => item.sessionIds.includes(currentSessionId)) ?? null, available }
}

/** 路径比较键：统一分隔符、去尾斜杠、小写（GUI 与 host 的路径书写可能不一致，Windows 大小写不敏感）。 */
function pathKey(path: string): string {
  return path.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()
}

/** 路径末段（title 缺失时的回退显示名）。 */
function lastSegment(path: string): string {
  const normalized = path.replace(/[/\\]+$/, '')
  const at = Math.max(normalized.lastIndexOf('\\'), normalized.lastIndexOf('/'))
  return at < 0 ? normalized : normalized.slice(at + 1)
}

/** dbName 短写：project-<hash>.db → project-<前 8 位>…（不符合该命名时按长度截断）。 */
function shortDbName(dbName: string): string {
  const match = /^project-([0-9a-f]+)\.db$/i.exec(dbName)
  return match === null ? dbName.slice(0, 14) : `project-${match[1]!.slice(0, 8)}…`
}

/** 项目库的显示名与「未注册工作区」标记：无法归属目录 → dbName 短写；否则 title > 路径末段。 */
function projectLabel(item: EngramProjectItem): { name: string; unregistered: boolean } {
  if (typeof item.path !== 'string' || item.path === '') return { name: shortDbName(item.dbName), unregistered: true }
  const title = item.title?.trim() ?? ''
  if (title !== '') return { name: title, unregistered: item.kind !== 'workspace' }
  return { name: lastSegment(item.path), unregistered: item.kind !== 'workspace' }
}

/** 下拉项文案：显示名（含未注册标记）· 记忆条数（库未建时给「—」，不显示 0）。 */
function projectOptionLabel(t: T, item: EngramProjectItem): string {
  const label = projectLabel(item)
  const parts = [label.unregistered ? `${label.name} · ${t('projectUnregistered')}` : label.name]
  parts.push(item.memories === null ? '—' : t('projectMemories', { n: item.memories }))
  return parts.join(' · ')
}

/** 跟随模式的目标：先按宿主工作区 id 匹配（最稳），对不上再按路径匹配；都匹配不到 → 进程默认库。 */
function matchFollowTarget(list: EngramWorkspacesView | null, workspace: HostWorkspaceView | null): EngramProjectItem | undefined {
  if (list === null || workspace === null) return undefined
  const byId = list.items.find(item => item.workspaceId === workspace.workspaceId)
  if (byId !== undefined) return byId
  const key = pathKey(workspace.path)
  return list.items.find(item => typeof item.path === 'string' && pathKey(item.path) === key)
}

/**
 * 项目宫殿 chip 的文案与 hover 说明：固定 / 跟随 / 未注册 / 无工作区信息四态。
 * 固定优先判定（host 清单不依赖客户端服务，固定态在缺服务时依然准确）。
 */
function projectChip(t: T, state: {
  mode: string
  available: boolean
  items: readonly EngramProjectItem[]
  followed: EngramProjectItem | undefined
  processDefaultPath: string | null
}): { label: string; title: string; tone: 'pinned' | 'follow' | 'muted' } {
  if (state.mode !== 'follow') {
    const item = state.items.find(entry => entry.dbName === state.mode)
    if (item === undefined) {
      return {
        label: t('projectPinned', { name: `${shortDbName(state.mode)} · ${t('projectUnregistered')}` }),
        title: state.mode,
        tone: 'pinned',
      }
    }
    const label = projectLabel(item)
    return {
      label: t('projectPinned', { name: label.unregistered ? `${label.name} · ${t('projectUnregistered')}` : label.name }),
      title: item.path ?? item.dbName,
      tone: 'pinned',
    }
  }
  if (!state.available) return { label: t('projectNoWorkspace'), title: t('projectFollowHint'), tone: 'muted' }
  if (state.followed === undefined) {
    return {
      label: t('projectPinned', { name: t('projectProcessDefault') }),
      title: state.processDefaultPath ?? t('projectFollowHint'),
      tone: 'pinned',
    }
  }
  const label = projectLabel(state.followed)
  return {
    label: t('projectFollowNamed', { name: label.unregistered ? `${label.name} · ${t('projectUnregistered')}` : label.name }),
    title: state.followed.path ?? t('projectFollowHint'),
    tone: 'follow',
  }
}

/** 绝对时间（审计时间线等需要精确时刻的位置）。 */
function fmtTime(ms: number): string {
  // 时间格式跟随浏览器环境语言（宿主界面语言通常与浏览器一致）。
  return new Date(ms).toLocaleString(navigator.language || 'zh-CN', { hour12: false })
}

/** 列表用的相对时间：1 分钟内「刚刚」，其后按分钟/小时/天取整。 */
function relTime(t: T, ms: number): string {
  const diff = Math.max(0, Date.now() - ms)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return t('timeJustNow')
  if (minutes < 60) return t('timeMinutesAgo', { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return t('timeHoursAgo', { n: hours })
  return t('timeDaysAgo', { n: Math.floor(hours / 24) })
}

/** 速览指标：大数 + 小标签 + 可选尾注；secondary 用于并排的次级计数。 */
function Metric({ label, value, tail, secondary }: {
  label: string
  value: string | number
  tail?: string | undefined
  secondary?: boolean
}): React.ReactElement {
  return (
    <div className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <b className={secondary === true ? `${styles.metricValue} ${styles.metricValueSecondary}` : styles.metricValue}>{value}</b>
      {tail !== undefined && <span className={styles.metricTail}>{tail}</span>}
    </div>
  )
}

/** 健康分环：SVG 描边进度（0-100），颜色随分数分档。 */
function HealthRing({ score }: { score: number }): React.ReactElement {
  const radius = 24
  const circumference = 2 * Math.PI * radius
  const filled = circumference * (Math.min(100, Math.max(0, score)) / 100)
  const tone = score >= 80 ? 'var(--dsw-alias-state-success-primary)'
    : score >= 50 ? 'var(--dsw-alias-state-warn-primary)'
      : 'var(--dsw-alias-state-error-primary)'
  return (
    <div className={styles.ring} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}>
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r={radius} fill="none" stroke="var(--dsw-alias-border-l2)" strokeWidth="4" />
        <circle cx="28" cy="28" r={radius} fill="none" stroke={tone} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={`${filled.toFixed(1)} ${circumference.toFixed(1)}`} />
      </svg>
      <b>{score}</b>
    </div>
  )
}

/** 细仪表条：重要性（品牌色）与置信（成功色）共用，conf 变体换色。 */
function Meter({ value, conf }: { value: number; conf?: boolean }): React.ReactElement {
  return (
    <span className={conf === true ? `${styles.meter} ${styles.conf}` : styles.meter}>
      <i style={{ width: `${String(Math.round(Math.min(1, Math.max(0, value)) * 100))}%` }} />
    </span>
  )
}

/** 关系 id 列表 → 等宽字体 chips（完整 id 放 title）。 */
function RelChips({ ids }: { ids: readonly string[] }): React.ReactElement {
  return (
    <div className={styles.relChips}>
      {ids.map(id => <span key={id} className={styles.relChip} title={id}>{id.slice(0, 18)}</span>)}
    </div>
  )
}

/** 行内审计区：属性网格 + 关系 chips + 操作时间线（review API）。 */
function ReviewBody({ t, recordId, scope, project }: {
  t: T
  recordId: string
  scope: 'user' | 'project' | 'shared'
  /** 项目宫殿选择器（仅用于重载依赖；注入在 api() 里做）。 */
  project: string | null
}): React.ReactElement {
  const [view, setView] = useState<ReviewView | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    api<ReviewView>(`review?scope=${scope}&id=${encodeURIComponent(recordId)}`)
      .then((data) => { if (!cancelled) setView(data) })
      .catch((error: Error) => { if (!cancelled) setFailed(error.message) })
    return () => { cancelled = true }
  }, [recordId, scope, project, t])
  if (failed !== null) return <div className={styles.expandLoading}>{t('loadFailed', { msg: failed })}</div>
  if (view === null) return <div className={styles.expandLoading}>{t('loading')}</div>
  const { record } = view
  const relations = (['supersededBy', 'supersedes', 'contradicts', 'related'] as const)
    .map(key => ({ key, label: REL_KEY[key], ids: view[key] ?? [] }))
    .filter(entry => entry.ids.length > 0)
  const operations = view.operations ?? []
  return (
    <div className={styles.reviewGrid}>
      <div>
        <dl className={styles.attrGrid}>
          <dt>{t('labelContent')}</dt>
          <dd>{record.content}</dd>
          <dt>{t('labelKind')}</dt>
          <dd><span className={roomPillClass(record.kind)}>{kindLabel(t, record.kind)}</span></dd>
          <dt>{t('labelStatus')}</dt>
          <dd><span className={`${styles.pill} ${styles[`status${record.status.charAt(0).toUpperCase()}${record.status.slice(1)}`] ?? ''}`}>{t(STATUS_KEY[record.status])}</span></dd>
          <dt>{t('importance')}</dt>
          <dd>{record.importance.toFixed(2)}<Meter value={record.importance} /></dd>
          <dt>{t('confidence')}</dt>
          <dd>{record.confidence.toFixed(2)}<Meter value={record.confidence} conf /></dd>
          <dt>{t('detailSource')}</dt>
          <dd>{sourceLabel(t, record)}</dd>
          <dt>{t('labelCreated')}</dt>
          <dd>{fmtTime(record.createdAt)}</dd>
        </dl>
        {relations.map(({ key, label, ids }) => (
          <div key={key} className={styles.relBlock}>
            <h5>{label === undefined ? key : t(label)}</h5>
            <RelChips ids={ids} />
          </div>
        ))}
      </div>
      <div>
        {(view.revisions ?? []).length > 0 && (
          <div className={styles.relBlock}>
            <h5>{t('detailRevisions')}</h5>
            <ul className={styles.timeline}>
              {view.revisions!.map((rev, index) => (
                <li key={index}>
                  <time>{fmtTime(rev.supersededAt)}</time>
                  <b>{kindLabel(t, rev.kind)}</b>
                  {' '}{rev.content}
                </li>
              ))}
            </ul>
          </div>
        )}
        {operations.length > 0 && (
          <div className={styles.relBlock}>
            <h5>{t('detailOperations')}</h5>
            <ul className={styles.timeline}>
              {operations.map((op, index) => (
                <li key={index}>
                  <time>{fmtTime(op.at)}</time>
                  <b>{opLabel(t, op.op)}</b>
                  {formatOpDetail(t, op.op, op.detail)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

/** 行内编辑表单：内容/种类/重要性 → POST update（旧条目归档，取代链保留）。 */
function EditForm({ t, record, onClose, onSaved, toast }: {
  t: T
  record: MemoryRow
  onClose: () => void
  onSaved: () => void
  toast: ToastController
}): React.ReactElement {
  const [content, setContent] = useState(record.content)
  const [kind, setKind] = useState(record.kind)
  const [importance, setImportance] = useState(record.importance)
  const save = (): void => {
    api('update', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: record.id, scope: record.scope, content, kind, importance }),
    })
      .then(onSaved)
      .catch((error: Error) => { toast.push('error', error.message) })
  }
  return (
    <div className={styles.editForm}>
      <div>
        <label className={styles.fieldLabel}>{t('labelContent')}</label>
        <textarea className={styles.input} rows={3} value={content} onChange={event => setContent(event.target.value)} />
      </div>
      <div>
        <label className={styles.fieldLabel}>{t('labelKind')}</label>
        {/* option 的 value 保持数据层英文枚举，仅显示文本本地化。 */}
        <select className={styles.input} value={kind} onChange={event => setKind(event.target.value)}>
          {KINDS.map(option => <option key={option} value={option}>{kindLabel(t, option)}</option>)}
        </select>
      </div>
      <div className={styles.fieldRow}>
        <div>
          <label className={styles.fieldLabel}>{`${t('importance')} ${importance.toFixed(2)}`}</label>
          <input type="range" min={0} max={1} step={0.05} value={importance}
            onChange={event => setImportance(Number(event.target.value))} />
        </div>
      </div>
      <div className={styles.modalFoot}>
        <button type="button" className={styles.button} onClick={onClose}>{t('cancel')}</button>
        <button type="button" className={`${styles.button} ${styles.primary}`} onClick={save}>{t('saveWithHint')}</button>
      </div>
    </div>
  )
}

/** search-test API 的命中行。 */
interface BenchHit {
  readonly id: string
  readonly score: number
  readonly via: 'fts' | 'vec' | 'both'
  readonly viaEdge?: { readonly from: string; readonly type: string }
  readonly scope: string
  readonly kind: string
  readonly content: string
}

/** search-test API 的返回结构。 */
interface BenchResult {
  readonly degraded: boolean
  readonly hits: readonly BenchHit[]
}

/** activity API 的行结构（两库 op_log 合并）。 */
interface ActivityRow {
  readonly at: number
  readonly op: string
  readonly targetId: string
  readonly detail: string | null
  readonly scope: 'user' | 'project'
}

/** 命中道 → 词典键。 */
const VIA_KEY: Record<BenchHit['via'], EngramKey> = { fts: 'viaFts', vec: 'viaVec', both: 'viaBoth' }

/** 召回测试台：输入查询跑真实检索，展示得分、命中原委（关键词/语义/边扩展）与内容。 */
function RecallBench({ t, scope }: { t: T; scope: 'user' | 'project' | 'shared' }): React.ReactElement {
  const [query, setQuery] = useState('')
  /** 默认随观察 scope，但用户可在 select 内手动切换 'all' / 其它；切换观察 scope 时重置。 */
  const [benchScope, setBenchScope] = useState<string>(scope)
  const [result, setResult] = useState<BenchResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 观察 scope 变化时同步 benchScope（用户在 select 里改过的「all」会被覆盖——刻意保持一致性）。
  useEffect(() => { setBenchScope(scope) }, [scope])
  const run = (): void => {
    if (query.trim() === '' || busy) return
    setBusy(true)
    // forceProject：'all' 模式（user + project）与 project 模式都要用当前选中的项目分库。
    api<BenchResult>(`search-test?q=${encodeURIComponent(query.trim())}&scope=${benchScope}`, undefined, true)
      .then((data) => { setResult(data); setError(null) })
      .catch((benchError: Error) => setError(benchError.message))
      .finally(() => setBusy(false))
  }
  const hits = result?.hits ?? []
  return (
    <div>
      <div className={styles.benchBar}>
        <input className={`${styles.input} ${styles.search}`} placeholder={t('benchPlaceholder')} value={query}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') run() }} />
        <select className={styles.input} value={benchScope}
          onChange={event => setBenchScope(event.target.value)}>
          <option value="all">{t('benchScopeAll')}</option>
          <option value="user">{t('scopeUser')}</option>
          <option value="project">{t('scopeProject')}</option>
          <option value="shared">{t('scopeShared')}</option>
        </select>
        <button type="button" className={`${styles.button} ${styles.primary}`}
          disabled={busy || query.trim() === ''} onClick={run}>{t('benchRun')}</button>
      </div>
      {error !== null && <div className={styles.expandLoading}>{t('loadFailed', { msg: error })}</div>}
      {result !== null && error === null && (
        <div className={styles.benchMeta}>
          <span>{t('benchHits', { n: hits.length })}</span>
          {result.degraded && <span className={styles.degradedNote}>{t('benchDegraded')}</span>}
        </div>
      )}
      <div className={styles.benchList}>
      {hits.map(hit => (
        <div key={hit.id} className={styles.benchRow}>
          <div className={styles.benchHead}>
            <span className={styles.viaChip}>{t(VIA_KEY[hit.via])}</span>
            {hit.viaEdge !== undefined && (
              <span className={styles.viaChip}
                title={`${hit.viaEdge.type} ${hit.viaEdge.from}`}>{t('viaEdgeLabel')} · {hit.viaEdge.type}</span>
            )}
            <span className={roomPillClass(hit.kind)}>{kindLabel(t, hit.kind)}</span>
            <span className={styles.benchScore}>{hit.score.toFixed(4)}</span>
          </div>
          <div className={styles.benchContent}>{hit.content}</div>
          <span className={styles.benchId} title={hit.id}>{hit.id}</span>
        </div>
      ))}
      </div>
      {result !== null && hits.length === 0 && error === null && (
        <div className={styles.benchEmpty}>{t('benchEmpty')}</div>
      )}
    </div>
  )
}

/** 活动日志 detail 的摘要：摄取/改写/压缩请求解析 JSON 字段，其余原样截断。
   窄侧栏下文本应尽量短，长详情交给 title 悬浮展示。 */
function activityDetail(t: T, detail: string | null): string {
  if (detail === null) return ''
  try {
    const parsed = JSON.parse(detail) as Record<string, unknown>
    if (typeof parsed.round === 'number' && typeof parsed.userText === 'string') {
      const mode = typeof parsed.mode === 'string' ? ` · ${parsed.mode}` : ''
      return `${t('round', { n: parsed.round })}${mode} · ${parsed.userText.slice(0, 48)}`
    }
    if (typeof parsed.query === 'string' && Array.isArray(parsed.queries)) {
      return `${t('benchRewrite', { n: parsed.queries.length })} · ${parsed.query.slice(0, 36)}`
    }
    if (typeof parsed.count === 'number' && Object.keys(parsed).length === 1) {
      return t('benchCompress', { n: parsed.count })
    }
    if (typeof parsed.batchId === 'string' && typeof parsed.sufficient === 'boolean') {
      const refs = Array.isArray(parsed.refs) ? parsed.refs.length : 0
      return `${parsed.batchId} · ${t(parsed.sufficient ? 'assessAdequate' : 'assessInadequate')} · ${t('assessRefs', { n: refs })}`
    }
    // 闭馆整理汇总：scope + 归档 / 合并 / 跳过三项计数。
    if (typeof parsed.archived === 'number' && typeof parsed.merged === 'number' && typeof parsed.skipped === 'number') {
      const scope = parsed.scope === 'project' ? t('scopeProject') : t('scopeUser')
      return `${scope} · ${t('consolidateArchived', { n: parsed.archived })} · ${t('consolidateMerged', { n: parsed.merged })} · ${t('consolidateSkipped', { n: parsed.skipped })}`
    }
    // 衰减归档：只有 archived 计数。
    if (typeof parsed.archived === 'number' && parsed.merged === undefined) {
      return t('decayArchived', { n: parsed.archived })
    }
    if (typeof parsed.assigned === 'number') return t('slotBackfilled', { n: parsed.assigned })
    if (typeof parsed.room === 'string') return t('roomOpened', { room: parsed.room })
    if (typeof parsed.grade === 'number' && typeof parsed.nextIntervalDays === 'number') {
      return t('reviewAnswered', { grade: parsed.grade, days: parsed.nextIntervalDays })
    }
  } catch {
    // 非 JSON（outcome 值等）：走末尾原样截断。
  }
  return detail.length > 56 ? `${detail.slice(0, 56)}…` : detail
}

/** 日志筛选分组：op 枚举 → 分组（数据层英文枚举只在显示层映射）。 */
type LogFilter = 'all' | 'write' | 'ingest' | 'retrieve' | 'organize'
const LOG_GROUPS: Readonly<Record<LogFilter, readonly string[] | null>> = {
  all: null,
  write: ['write', 'update', 'forget', 'restore', 'decay', 'superseded', 'outcome-report'],
  ingest: ['ingest-request', 'ingest-done'],
  retrieve: ['search-rewrite-request', 'compress-request', 'assess'],
  organize: ['distill-request', 'consolidation', 'slot-assign', 'slot-backfill', 'room-open', 'review-answer', 'profile-edit'],
}
const LOG_FILTER_KEY: Readonly<Record<LogFilter, EngramKey>> = {
  all: 'logFilterAll',
  write: 'logFilterWrite',
  ingest: 'logFilterIngest',
  retrieve: 'logFilterRetrieve',
  organize: 'logFilterOrganize',
}
/** 分组 → 行首色点类（与工具条计数、筛选分组同色）。 */
const LOG_DOT: Readonly<Record<'write' | 'ingest' | 'retrieve' | 'organize', string>> = {
  write: 'logDotWrite',
  ingest: 'logDotIngest',
  retrieve: 'logDotRetrieve',
  organize: 'logDotOrganize',
}
/** op 枚举 → 所属筛选分组（未归类返回 all）。 */
function logGroupOf(op: string): LogFilter {
  for (const group of ['write', 'ingest', 'retrieve', 'organize'] as const) {
    if (LOG_GROUPS[group]?.includes(op) === true) return group
  }
  return 'all'
}
/** 行首色点类名：未归类的 op 用中性灰点，避免出现无颜色的空列。 */
function logDotClass(op: string): string {
  const group = logGroupOf(op)
  const base = styles.logDot ?? ''
  return group === 'all' ? base : `${base} ${styles[LOG_DOT[group]] ?? ''}`
}

/** 行级 LCS 对齐：把两段文本按行 diff，输出 same/add/del 序列（行数少，O(n·m) DP 足够）。 */
function lineDiff(oldText: string, newText: string): readonly { kind: 'same' | 'add' | 'del'; text: string }[] {
  const a = oldText.split('\n')
  const b = newText.split('\n')
  const m = a.length
  const n = b.length
  // dp[i][j] = a[i..] 与 b[j..] 的最长公共子序列长度（末行/末列补 0）。
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
    }
  }
  const rows: { kind: 'same' | 'add' | 'del'; text: string }[] = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) { rows.push({ kind: 'same', text: a[i]! }); i += 1; j += 1 }
    else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) { rows.push({ kind: 'del', text: a[i]! }); i += 1 }
    else { rows.push({ kind: 'add', text: b[j]! }); j += 1 }
  }
  while (i < m) { rows.push({ kind: 'del', text: a[i]! }); i += 1 }
  while (j < n) { rows.push({ kind: 'add', text: b[j]! }); j += 1 }
  return rows
}

/** profile-block 路由的响应体（block 为 null = 该 scope 尚未创建 curated block）。 */
interface ProfileBlockView {
  scope: string
  block: { content: string; version: number; updatedAt: number } | null
  versions: readonly { version: number; content: string; source: string; at: number }[]
}

/**
 * 画像 curated block 审计卡：当前内容 + 版本历史 + 任意两版本的行级 diff。
 * 只读视图（编辑走 engram_profile_edit 工具，乐观锁在存储层）；scope/project 变化时重载。
 */
function ProfileCard({ t, scope, project }: { t: T; scope: 'user' | 'project' | 'shared'; project: string | null }): React.ReactElement {
  const [data, setData] = useState<ProfileBlockView | null>(null)
  const [failed, setFailed] = useState(false)
  const [baseVersion, setBaseVersion] = useState<number | null>(null)
  const [targetVersion, setTargetVersion] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    api<ProfileBlockView>(`profile-block?scope=${scope}`, undefined, true)
      .then((view) => {
        if (cancelled) return
        setData(view)
        setFailed(false)
        // 默认对比：基准 = 上一版，目标 = 当前版（仅一版时不启用 diff）。
        setBaseVersion(view.versions.length > 1 ? view.versions[1]!.version : null)
        setTargetVersion(view.versions.length > 0 ? view.versions[0]!.version : null)
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [scope, project])
  if (failed) {
    return <div className={styles.expandLoading}>{t('profileLoadFailed')}</div>
  }
  if (data === null) {
    return <div className={styles.expandLoading}>{t('loading')}</div>
  }
  if (data.block === null) {
    return (
      <div className={styles.expandLoading}>
        <p>{t('profileEmpty')}</p>
        <p className={styles.sectionHint}>{t('profileEmptyHint')}</p>
      </div>
    )
  }
  const versions = data.versions
  const byVersion = new Map(versions.map(version => [version.version, version]))
  const base = baseVersion === null ? undefined : byVersion.get(baseVersion)
  const target = targetVersion === null ? undefined : byVersion.get(targetVersion)
  const diffRows = base !== undefined && target !== undefined ? lineDiff(base.content, target.content) : []
  const hasDiff = diffRows.some(row => row.kind !== 'same')
  return (
    <div className={styles.profileCard}>
      <h5 className={styles.profileHeading}>{t('profileCurrent', { n: data.block.version })}</h5>
      <pre className={styles.profileContent}>{data.block.content}</pre>
      {versions.length > 1 && (
        <>
          <h5 className={styles.profileHeading}>{t('profileHistory')}</h5>
          <div className={styles.profilePickerRow}>
            <label>
              <span className={styles.sectionHint}>{t('profileDiffBase')}</span>
              <select className={styles.profileSelect} value={baseVersion ?? undefined}
                onChange={event => { setBaseVersion(Number(event.target.value)) }}>
                {versions.map(version => (
                  <option key={version.version} value={version.version}>
                    v{version.version} · {version.source === 'rollback' ? t('profileSourceRollback') : t('profileSourceEdit')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={styles.sectionHint}>{t('profileDiffTarget')}</span>
              <select className={styles.profileSelect} value={targetVersion ?? undefined}
                onChange={event => { setTargetVersion(Number(event.target.value)) }}>
                {versions.map(version => (
                  <option key={version.version} value={version.version}>
                    v{version.version} · {version.source === 'rollback' ? t('profileSourceRollback') : t('profileSourceEdit')}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {base !== undefined && target !== undefined && (
            <div className={styles.profileDiff}>
              {hasDiff
                ? diffRows.map((row, index) => (
                  <div key={index} className={
                    row.kind === 'add' ? styles.profileDiffAdd : row.kind === 'del' ? styles.profileDiffDel : styles.profileDiffSame
                  }>{row.kind === 'add' ? '+ ' : row.kind === 'del' ? '- ' : '  '}{row.text}</div>
                ))
                : <div className={styles.sectionHint}>{t('profileDiffNone')}</div>}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * 管家日志整页视图：顶部近 7 天三个计数，下面是两库合并的完整 op_log
 * （时间 · 操作 · 宫殿 · 摘要），可按操作类别筛选；不再限高裁切，供逐条审计。
 * user 侧照旧合并，project 侧跟随项目宫殿选择器（api 的 forceProject）。
 */
function LogPanel({ t, telemetry, project }: {
  t: T
  telemetry: TelemetrySnapshot | null
  /** 项目宫殿选择器（仅用于重载依赖；注入在 api() 里做）。 */
  project: string | null
}): React.ReactElement {
  const [rows, setRows] = useState<ActivityRow[] | null>(null)
  const [filter, setFilter] = useState<LogFilter>('all')
  useEffect(() => {
    let cancelled = false
    api<{ operations: ActivityRow[] }>('activity?limit=50', undefined, true)
      .then((data) => { if (!cancelled) setRows(data.operations) })
      .catch(() => { if (!cancelled) setRows([]) })
    return () => { cancelled = true }
  }, [project])
  const allow = LOG_GROUPS[filter]
  const visible = (rows ?? []).filter(row => allow === null || allow.includes(row.op))
  const counts = telemetry?.counts
  return (
    <section className={styles.section}>
      {/* 一条工具条：标题 + 条数 + 近 7 天三类计数（带类别色点）+ 类别筛选，
          取代原先「独立计数卡 + 筛选行」两段式。 */}
      <div className={styles.logToolbar}>
        <h4 className={styles.sectionTitle}>{t('tabLog')}</h4>
        <span className={styles.sectionHint}>{t('logCount', { n: visible.length })}</span>
        <span className={styles.logCounts}>
          <span><i className={`${styles.logDot} ${styles.logDotWrite}`} aria-hidden="true" />{t('teleWrites')} <b>{counts?.writes ?? 0}</b></span>
          <span><i className={`${styles.logDot} ${styles.logDotIngest}`} aria-hidden="true" />{t('teleIngest')} <b>{counts?.ingestDones ?? 0}</b></span>
          <span><i className={`${styles.logDot} ${styles.logDotOrganize}`} aria-hidden="true" />{t('teleConsolidate')} <b>{counts?.consolidations ?? 0}</b></span>
        </span>
        <div className={styles.segGroup} role="tablist">
          {(['all', 'write', 'ingest', 'retrieve', 'organize'] as const).map(option => (
            <button key={option} type="button" role="tab" aria-selected={filter === option}
              className={filter === option ? `${styles.segItem} ${styles.on}` : styles.segItem}
              onClick={() => { setFilter(option) }}>{t(LOG_FILTER_KEY[option])}</button>
          ))}
        </div>
      </div>
      <div className={styles.panelCard}>
        {rows === null
          ? <div className={styles.expandLoading}>{t('loading')}</div>
          : visible.length === 0
            ? <div className={styles.expandLoading}>{t('activityEmpty')}</div>
            : (
              <div className={styles.logList}>
                {visible.map((op, index) => (
                  <div key={index} className={styles.logRow}>
                    <i className={logDotClass(op.op)} aria-hidden="true" />
                    <span className={styles.logTime}>{relTime(t, op.at)}</span>
                    <span className={styles.logOp}>{opLabel(t, op.op)}</span>
                    <span className={styles.logScope}>{op.scope === 'user' ? t('scopeUser') : t('scopeProject')}</span>
                    <span className={styles.logDetail} title={op.detail ?? ''}>{activityDetail(t, op.detail)}</span>
                  </div>
                ))}
              </div>
            )}
      </div>
    </section>
  )
}

/** 入殿导航：根据当前 scope 的 active 记忆给出开场邀请 + 候选记忆列表；点击可展开抽屉。
 *  顶部 kind chip（全部 / fact / preference / decision / episode / skill）切换 focusKind，
 *  触发后端按该 kind 优先选前 N 条作为开场建议。 */
function TourProposalCard({ t, scope, project, onSelect }: {
  t: T
  scope: 'user' | 'project' | 'shared'
  /** 项目宫殿选择器（仅用于重载依赖；注入在 api() 里做）。 */
  project: string | null
  onSelect: (id: string) => void
}): React.ReactElement {
  interface Stop { id: string; kind: string; content: string; importance: number; confidence: number }
  interface Proposal { greeting: string; activeCount: number; empty: boolean; suggestedStops: readonly Stop[] }
  const KINDS_FOCUS = ['', 'fact', 'preference', 'decision', 'episode', 'skill'] as const
  const [focusKind, setFocusKind] = usePersistedState<string>('tour.focusKind', '', KINDS_FOCUS)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  useEffect(() => {
    let cancelled = false
    const path = focusKind === ''
      ? `tour-proposal?scope=${scope}`
      : `tour-proposal?scope=${scope}&focusKind=${focusKind}`
    api<Proposal>(path)
      .then((data) => { if (!cancelled) setProposal(data) })
      .catch(() => { if (!cancelled) setProposal({ greeting: t('tourProposalEmpty'), activeCount: 0, empty: true, suggestedStops: [] }) })
    return () => { cancelled = true }
  }, [t, scope, project, focusKind])
  const labelKind = (kind: string): string => {
    if (kind === '') return t('tourFocusAll')
    const key = KIND_KEY[kind]
    return key === undefined ? kind : t(key)
  }
  if (proposal === null) return <div className={styles.expandLoading}>{t('loading')}</div>
  return (
    <div className={styles.tourProposal}>
      <div className={styles.chipRow} role="tablist" aria-label="focus-kind">
        {KINDS_FOCUS.map(kind => (
          <button key={kind || 'all'} type="button" role="tab"
            aria-selected={focusKind === kind}
            className={focusKind === kind ? `${styles.chip} ${styles.chipOn}` : styles.chip}
            onClick={() => { setFocusKind(kind) }}>
            {labelKind(kind)}
          </button>
        ))}
      </div>
      {proposal.empty
        ? <div className={styles.expandLoading}>{t('tourProposalEmpty')}</div>
        : (
          <>
            <p className={styles.tourGreeting}>{proposal.greeting}</p>
            <ol className={styles.tourStops}>
              {proposal.suggestedStops.map((stop, index) => (
                <li key={stop.id}>
                  <button type="button" className={styles.tourStop} onClick={() => { onSelect(stop.id) }}>
                    <span className={styles.tourStopIndex}>{index + 1}</span>
                    <span className={styles.tourStopBody}>
                      <span className={styles.tourStopKind}>{kindLabel(t, stop.kind)}</span>
                      <span className={styles.tourStopText}>{stop.content.length > 60 ? `${stop.content.slice(0, 60)}…` : stop.content}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <p className={styles.tourHint}>{t('tourProposalHint')}</p>
          </>
        )}
    </div>
  )
}

/** 翻新清单：扫描 active 条目，给出 merge / demote / review / split 四类建议；带手动刷新 + 写回按钮。
 *  - review / split：跳到对应记忆抽屉查看（无副作用）。
 *  - demote：调用 engram_forget（带三问墓志铭），记忆转 archived。
 *  - merge：触发当前 scope 的 engram_distill（用户级闭馆整理），把多条相似记忆蒸馏为一条高层规律。 */
function RefurbCard({ t, scope, project, onSelect, onAfterAction, toast }: {
  t: T
  scope: 'user' | 'project' | 'shared'
  /** 项目宫殿选择器（仅用于重载依赖；注入在 api() 里做）。 */
  project: string | null
  onSelect: (id: string) => void
  onAfterAction: () => void
  toast: ToastController
}): React.ReactElement {
  interface Suggestion { action: 'merge' | 'demote' | 'review' | 'split'; primaryId: string; candidates: readonly string[]; reason: string; confidence: number }
  interface RefurbReport { count: number; suggestions: readonly Suggestion[] }
  const [report, setReport] = useState<RefurbReport | null>(null)
  const [busy, setBusy] = useState(false)
  const reload = useCallback(() => {
    setBusy(true)
    api<RefurbReport>(`refurb?scope=${scope}`)
      .then((data) => { setReport(data) })
      .catch(() => { setReport({ count: 0, suggestions: [] }) })
      .finally(() => { setBusy(false) })
  }, [scope, project])
  useEffect(() => { reload() }, [reload])
  const labelOf = (action: Suggestion['action']): string => {
    switch (action) {
      case 'demote': return t('refurbActionDemote')
      case 'merge': return t('refurbActionMerge')
      case 'review': return t('refurbActionReview')
      case 'split': return t('refurbActionSplit')
    }
  }
  /** 执行建议：review/split 仅跳转；demote/merge 调写接口。 */
  const execute = useCallback(async (suggestion: Suggestion) => {
    if (suggestion.action === 'review' || suggestion.action === 'split') {
      onSelect(suggestion.primaryId)
      return
    }
    if (suggestion.action === 'demote') {
      if (!await confirmAction(t('refurbConfirmDemote'))) return
      setBusy(true)
      api<{ id: string }>('forget', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: suggestion.primaryId,
          scope,
          reason: '翻新清单降级',
          affects: '无',
          stillUseful: '可经 engram_restore 复原',
        }),
      })
        .then(() => {
          reload()
          onAfterAction()
          toast.push('success', t('refurbDemoteDone'))
        })
        .catch((error: Error) => { toast.push('error', t('refurbActionFailed', { msg: error.message })) })
        .finally(() => { setBusy(false) })
      return
    }
    if (suggestion.action === 'merge') {
      const n = suggestion.candidates.length + 1
      if (n < 2) {
        toast.push('warning', t('refurbMergeEmpty'))
        return
      }
      if (!await confirmAction(t('refurbConfirmMerge', { n }))) return
      setBusy(true)
      // 透传 candidates：后端 runConsolidation 仅把这些 ids 当合并种子，其它条目仅在与种子相似时被并入。
      const candidates = [suggestion.primaryId, ...suggestion.candidates]
      api<Record<string, unknown>>('consolidate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scope, candidates }),
      })
        .then(() => {
          reload()
          onAfterAction()
          toast.push('success', t('refurbMergeDone'))
        })
        .catch((error: Error) => { toast.push('error', t('refurbActionFailed', { msg: error.message })) })
        .finally(() => { setBusy(false) })
    }
  }, [reload, onSelect, onAfterAction, toast, t, scope])
  if (report === null) return <div className={styles.expandLoading}>{t('loading')}</div>
  return (
    <div className={styles.refurb}>
      <div className={styles.refurbHead}>
        <span className={styles.refurbCount}>{t('refurbCount', { n: report.count })}</span>
        <button type="button" className={styles.button} disabled={busy} onClick={reload}>{t('refurbRun')}</button>
      </div>
      {report.count === 0
        ? <div className={styles.expandLoading}>{t('refurbEmpty')}</div>
        : (
          <ul className={styles.refurbList}>
            {report.suggestions.map((suggestion, index) => (
              <li key={`${suggestion.action}-${suggestion.primaryId}-${index}`} className={styles.refurbItem}>
                <button type="button" className={styles.refurbBadge} onClick={() => { onSelect(suggestion.primaryId) }}>
                  {labelOf(suggestion.action)}
                </button>
                <div className={styles.refurbReason}>{suggestion.reason}</div>
                <span className={styles.refurbConfidence}>{(suggestion.confidence * 100).toFixed(0)}%</span>
                <button type="button" className={`${styles.refurbExec} ${styles.button}`} disabled={busy}
                  onClick={() => { execute(suggestion) }}>{t('refurbExecute')}</button>
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}

/** 走廊鸟瞰数据拉取与节点/边状态（命中 active + archived，forgotten 默认隐藏）。 */
interface CorridorGraph {
  readonly nodes: ReadonlyArray<{
    readonly id: string
    readonly scope: string
    readonly kind: string
    readonly status: string
    readonly importance: number
    readonly confidence: number
    readonly title: string
    readonly content?: string
  }>
  readonly edges: ReadonlyArray<{ readonly id: string; readonly from: string; readonly to: string; readonly type: string }>
}

function CorridorPanel({ t, scope, project, onSelect }: {
  t: T
  scope: 'user' | 'project' | 'shared'
  /** 项目宫殿选择器（仅用于重载依赖；注入在 api() 里做）。 */
  project: string | null
  onSelect: (id: string) => void
}): React.ReactElement {
  const [graph, setGraph] = useState<CorridorGraph | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    api<CorridorGraph>(`corridor?status=active,archived&scope=${scope}`)
      .then(data => { if (!cancelled) setGraph(data); setFailed(null) })
      .catch((err: Error) => { if (!cancelled) setFailed(err.message) })
    return () => { cancelled = true }
  }, [scope, project])
  if (failed !== null) return <div className={styles.expandLoading}>{t('corridorFailed')}：{failed}</div>
  if (graph === null) return <div className={styles.expandLoading}>{t('corridorLoad')}</div>
  if (graph.nodes.length === 0) return <div className={styles.empty}>{t('corridorEmpty')}</div>
  return <CorridorMap scope={scope} nodes={graph.nodes} edges={graph.edges} onSelect={onSelect} t={t} />
}

/** GET /api/dsh/engram/episode-timeline 的情景行（host 已精简为四字段）。 */
interface EpisodeRowView {
  readonly id: string
  readonly kind: string
  readonly content: string
  readonly createdAt: number
}

/** GET /api/dsh/engram/episode-timeline 的组模式返回（组头带摄取期生成的会话摘要）。 */
interface EpisodeGroupsView {
  readonly groups: ReadonlyArray<{
    readonly sessionId: string | null
    readonly summary?: string | undefined
    readonly startedAt: number
    readonly endedAt: number
    readonly episodes: readonly EpisodeRowView[]
  }>
}

/** 邻近扩展（around 模式）返回：锚点条目 + 窗口内的情景邻居。 */
interface EpisodeAroundView {
  readonly anchor: EpisodeRowView
  readonly neighbors: readonly EpisodeRowView[]
}

/**
 * 情景时间线视图：按会话分组浏览 episode 往事，组头展示摄取期生成的一句话摘要；
 * 条目点「邻近」展开该时刻 ± 窗口的时间邻近扩展卡（回答「当时前后还发生了什么」）。
 */
function EpisodeTimelineView({ t, scope, project, reloadTick }: {
  t: T
  scope: 'user' | 'project' | 'shared'
  /** 项目宫殿选择器（仅用于重载依赖；注入在 api() 里做）。 */
  project: string | null
  reloadTick: number
}): React.ReactElement {
  const [sinceDate, setSinceDate] = useState('')
  const [untilDate, setUntilDate] = useState('')
  const [sessionIdInput, setSessionIdInput] = useState('')
  /** 已应用的过滤条件：date/文本输入不即时触发请求，点「应用」才生效。 */
  const [applied, setApplied] = useState<{ readonly since: string; readonly until: string; readonly sessionId: string }>({ since: '', until: '', sessionId: '' })
  const [data, setData] = useState<EpisodeGroupsView | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  /** 邻近扩展卡（null = 未展开）；busy 防重复点击。 */
  const [around, setAround] = useState<EpisodeAroundView | null>(null)
  const [aroundBusy, setAroundBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ scope })
    // date input 值按本地时区折算成当天首尾毫秒（T00:00:00 / T23:59:59.999）。
    if (applied.since !== '') params.set('since', String(new Date(`${applied.since}T00:00:00`).getTime()))
    if (applied.until !== '') params.set('until', String(new Date(`${applied.until}T23:59:59.999`).getTime()))
    if (applied.sessionId !== '') params.set('sessionId', applied.sessionId)
    api<EpisodeGroupsView>(`episode-timeline?${params.toString()}`)
      .then(d => { if (!cancelled) { setData(d); setFailed(null) } })
      .catch((err: Error) => { if (!cancelled) setFailed(err.message) })
    return () => { cancelled = true }
  }, [scope, project, applied, reloadTick])

  /** 展开邻近扩展：以该条目为锚点查同库 ±60 分钟窗口内的情景（窗口由 host 缺省）。 */
  const openAround = (id: string): void => {
    setAroundBusy(true)
    api<EpisodeAroundView>(`episode-timeline?scope=${scope}&around=${encodeURIComponent(id)}`)
      .then(d => { setAround(d); setAroundBusy(false); setFailed(null) })
      .catch((err: Error) => { setFailed(err.message); setAroundBusy(false) })
  }

  /** 条目行：时刻 + 房间 + 内容 + 邻近按钮；id 放 title 便于复制。 */
  const renderRow = (row: EpisodeRowView): React.ReactElement => (
    <div key={row.id} className={styles.episodeRow} title={row.id}>
      <time className={styles.episodeRowTime}>{fmtTime(row.createdAt)}</time>
      <span className={styles.episodeRowKind}>{kindLabel(t, row.kind)}</span>
      <span className={styles.episodeRowText}>{row.content}</span>
      <button type="button" className={styles.button} disabled={aroundBusy}
        onClick={() => { openAround(row.id) }}>
        {t('episodeNearby')}
      </button>
    </div>
  )

  return (
    <>
      {/* 过滤行：日期范围 + 可选会话 id；「应用」后生效，「重置」回到全量。 */}
      <div className={styles.toolbarRow}>
        <input type="date" className={styles.input} value={sinceDate} aria-label={t('episodeSince')}
          onChange={event => { setSinceDate(event.target.value) }} />
        <span className={styles.episodeRangeSep} aria-hidden="true">–</span>
        <input type="date" className={styles.input} value={untilDate} aria-label={t('episodeUntil')}
          onChange={event => { setUntilDate(event.target.value) }} />
        <input className={`${styles.input} ${styles.search}`} placeholder={t('episodeSessionId')} value={sessionIdInput}
          onChange={event => { setSessionIdInput(event.target.value) }} />
        <button type="button" className={`${styles.button} ${styles.primary}`}
          onClick={() => { setApplied({ since: sinceDate, until: untilDate, sessionId: sessionIdInput.trim() }); setAround(null) }}>
          {t('episodeApply')}
        </button>
        <button type="button" className={styles.button}
          onClick={() => {
            setSinceDate(''); setUntilDate(''); setSessionIdInput('')
            setApplied({ since: '', until: '', sessionId: '' }); setAround(null)
          }}>
          {t('episodeReset')}
        </button>
      </div>
      {failed !== null && <div className={styles.expandLoading}>{t('loadFailed', { msg: failed })}</div>}
      {around !== null && (
        <section className={`${styles.panelCard} ${styles.episodeAround}`}>
          <header className={styles.episodeAroundHead}>
            <b>{t('episodeAroundTitle')}</b>
            <button type="button" className={styles.button} onClick={() => { setAround(null) }}>
              {t('episodeClose')}
            </button>
          </header>
          {renderRow(around.anchor)}
          {around.neighbors.length === 0
            ? <p className={styles.sectionHint}>{t('episodeAroundEmpty')}</p>
            : around.neighbors.map(renderRow)}
        </section>
      )}
      {data === null && failed === null && <div className={styles.expandLoading}>{t('loading')}</div>}
      {data !== null && data.groups.length === 0 && <div className={styles.empty}>{t('episodeNoGroups')}</div>}
      {data?.groups.map(group => (
        <section key={group.sessionId ?? 'none'} className={styles.panelCard}>
          <header className={styles.episodeHead}>
            {group.summary === undefined
              ? <p className={`${styles.episodeSummary} ${styles.episodeSummaryMissing}`}>{t('episodeSummaryMissing')}</p>
              : <p className={styles.episodeSummary}>{group.summary}</p>}
            <span className={styles.episodeHeadMeta}>
              {group.sessionId === null ? t('episodeNoSession') : `#${group.sessionId}`}
              {' · '}
              {new Date(group.startedAt).toLocaleDateString()} ~ {new Date(group.endedAt).toLocaleDateString()}
              {' · '}
              {t('episodeEntries', { n: group.episodes.length })}
            </span>
          </header>
          <div>{group.episodes.map(renderRow)}</div>
        </section>
      ))}
    </>
  )
}

/** GET /api/dsh/engram/entities 的行（host 返回 { entity, memoryCount }，entity 为实体记录的显示字段）。 */
interface EntityListItemView {
  readonly entity: {
    readonly id: string
    readonly name: string
    readonly kind: string
    readonly aliases: readonly string[]
  }
  readonly memoryCount: number
}

/** GET /api/dsh/engram/entities 返回（updated_at 倒序，附总数）。 */
interface EntityListView {
  readonly items: readonly EntityListItemView[]
  readonly total: number
}

/** GET /api/dsh/engram/entity 返回：实体 + 关联 active 记忆（创建时间倒序）。 */
interface EntityDetailView {
  readonly entity: EntityListItemView['entity']
  readonly memories: readonly MemoryRow[]
}

/** GET /api/dsh/engram/facts 返回的单条事实（面板只读显示所需字段）。 */
interface FactView {
  readonly id: string
  readonly content: string
  readonly validAt: number
  readonly invalidAt: number | null
  readonly replacedBy: string | null
}

/** GET /api/dsh/engram/facts 返回（valid_at 倒序，附总数）。 */
interface EntityFactsView {
  readonly items: readonly FactView[]
  readonly total: number
}

/** 实体类别数据值 → 词典键（筛选 chips、列表行与详情卡共用一份映射）。 */
const ENTITY_KIND_KEY: Record<string, EngramKey> = {
  person: 'entityKindPerson',
  project: 'entityKindProject',
  tool: 'entityKindTool',
  concept: 'entityKindConcept',
  other: 'entityKindOther',
}
const ENTITY_KINDS = ['person', 'project', 'tool', 'concept', 'other'] as const

/** 实体行的类别标签（未知 kind 回退「其他」）。 */
function entityKindLabel(t: T, kind: string): string {
  return t(ENTITY_KIND_KEY[kind] ?? 'entityKindOther')
}

/**
 * 实体词典视图：浏览摄取期从记忆中抽取的实体（人物/项目/工具/概念），
 * 类别 chips + 名称/别名子串过滤；点「查看」展开该实体牵出的关联记忆卡。
 */
function EntityView({ t, scope, project, reloadTick }: {
  t: T
  scope: 'user' | 'project' | 'shared'
  /** 项目宫殿选择器（仅用于重载依赖；注入在 api() 里做）。 */
  project: string | null
  reloadTick: number
}): React.ReactElement {
  const [kind, setKind] = useState<'all' | (typeof ENTITY_KINDS)[number]>('all')
  const [q, setQ] = useState('')
  const [data, setData] = useState<EntityListView | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  /** 展开的实体详情卡（null = 未展开）；busy 防重复点击。 */
  const [detail, setDetail] = useState<EntityDetailView | null>(null)
  const [facts, setFacts] = useState<EntityFactsView | null>(null)
  const [detailBusy, setDetailBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ scope })
    if (kind !== 'all') params.set('kind', kind)
    if (q !== '') params.set('q', q)
    api<EntityListView>(`entities?${params.toString()}`)
      .then(d => { if (!cancelled) { setData(d); setFailed(null) } })
      .catch((err: Error) => { if (!cancelled) setFailed(err.message) })
    return () => { cancelled = true }
  }, [scope, project, kind, q, reloadTick])

  /** 展开实体详情：实体记录 + 关联记忆 + 事实链全貌（含已失效，看事实如何演变）。 */
  const openDetail = (id: string): void => {
    setDetailBusy(true)
    Promise.all([
      api<EntityDetailView>(`entity?scope=${scope}&id=${encodeURIComponent(id)}`),
      api<EntityFactsView>(`facts?scope=${scope}&entityId=${encodeURIComponent(id)}&includeInvalid=1`),
    ])
      .then(([d, f]) => { setDetail(d); setFacts(f); setDetailBusy(false); setFailed(null) })
      .catch((err: Error) => { setFailed(err.message); setDetailBusy(false) })
  }

  /** 详情卡里的关联记忆行：时刻 + 房间 + 内容（只读观测，不提供编辑入口）。 */
  const renderMemory = (row: MemoryRow): React.ReactElement => (
    <div key={row.id} className={styles.episodeRow} title={row.id}>
      <time className={styles.episodeRowTime}>{fmtTime(row.createdAt)}</time>
      <span className={styles.episodeRowKind}>{kindLabel(t, row.kind)}</span>
      <span className={styles.episodeRowText}>{row.content}</span>
    </div>
  )

  /** 详情卡里的事实行：生效日期 + 状态标签 + 陈述；失效行标「已失效」。 */
  const renderFact = (fact: FactView): React.ReactElement => (
    <div key={fact.id} className={styles.episodeRow} title={fact.id}>
      <time className={styles.episodeRowTime}>{new Date(fact.validAt).toLocaleDateString()}</time>
      <span className={styles.episodeRowKind}>{fact.invalidAt === null ? t('factValid') : t('factInvalid')}</span>
      <span className={styles.episodeRowText}>{fact.content}</span>
    </div>
  )

  return (
    <>
      {/* 过滤行：类别 chips；切换过滤时收起已展开的详情卡，避免与新列表错位。 */}
      <div className={styles.chipRow}>
        {([
          ['all', t('entityKindAll')],
          ...ENTITY_KINDS.map(option => [option, t(ENTITY_KIND_KEY[option] ?? 'entityKindOther')] as const),
        ] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={kind === value}
            className={kind === value ? `${styles.chip} ${styles.chipOn}` : styles.chip}
            onClick={() => { setKind(value); setDetail(null); setFacts(null) }}>
            {label}
          </button>
        ))}
      </div>
      <div className={styles.toolbarRow}>
        <input className={`${styles.input} ${styles.search}`} placeholder={t('entitySearchPlaceholder')} value={q}
          onChange={event => { setQ(event.target.value.trim()); setDetail(null); setFacts(null) }} />
        {data !== null && <span className={styles.sectionHint}>{t('entityCount', { n: data.total })}</span>}
      </div>
      {failed !== null && <div className={styles.expandLoading}>{t('loadFailed', { msg: failed })}</div>}
      {detail !== null && (
        <section className={`${styles.panelCard} ${styles.episodeAround}`}>
          <header className={styles.episodeAroundHead}>
            <b>{detail.entity.name}</b>
            <span className={styles.episodeRowKind}>{entityKindLabel(t, detail.entity.kind)}</span>
            <button type="button" className={styles.button} onClick={() => { setDetail(null); setFacts(null) }}>
              {t('episodeClose')}
            </button>
          </header>
          {detail.entity.aliases.length > 0 && (
            <p className={styles.sectionHint}>{`${t('entityAliases')}：${detail.entity.aliases.join('、')}`}</p>
          )}
          {detail.memories.length === 0
            ? <p className={styles.sectionHint}>{t('entityNoMemories')}</p>
            : <div>{detail.memories.map(renderMemory)}</div>}
          {facts !== null && (
            <>
              <p className={styles.sectionHint}>{t('factSection', { n: facts.total })}</p>
              {facts.items.length === 0
                ? <p className={styles.sectionHint}>{t('factEmpty')}</p>
                : <div>{facts.items.map(renderFact)}</div>}
            </>
          )}
        </section>
      )}
      {data === null && failed === null && <div className={styles.expandLoading}>{t('loading')}</div>}
      {data !== null && data.items.length === 0 && <div className={styles.empty}>{t('entityEmpty')}</div>}
      {data !== null && data.items.map(item => (
        <div key={item.entity.id} className={styles.episodeRow} title={item.entity.id}>
          <span className={styles.episodeRowKind}>{entityKindLabel(t, item.entity.kind)}</span>
          <span className={styles.episodeRowText}>
            {item.entity.name}
            {item.entity.aliases.length > 0 && (
              <small className={styles.sectionHint}>{`（${item.entity.aliases.join('、')}）`}</small>
            )}
          </span>
          <span className={styles.episodeRowTime}>{t('entityMemories', { n: item.memoryCount })}</span>
          <button type="button" className={styles.button} disabled={detailBusy}
            onClick={() => { openDetail(item.entity.id) }}>
            {t('entityOpen')}
          </button>
        </div>
      ))}
    </>
  )
}

/** 宫殿健康分卡：5 维 0-100 + 总分 + 每维度进度条。 */
interface HealthReport {
  readonly overall: number
  readonly parts: ReadonlyArray<{
    readonly scope: string
    readonly score: number
    readonly signal: number
    readonly activeRatio: number
    readonly edgeCount: number
    readonly redacted: number
    readonly archivedRatio: number
  }>
  readonly evaluatedAt: number
}

/** 房间目录：kind → 条目数（stats.byKind）；色块与房间 pill 同色相。 */
function RoomDirectory({ t, byKind }: { t: T; byKind: Readonly<Record<string, number>> }): React.ReactElement {
  return (
    <div className={styles.roomList}>
      {KINDS.map(kind => (
        <div key={kind} className={styles.roomRow}>
          <span className={`${styles.roomSwatch} ${styles[ROOM_CLASS[kind] ?? ''] ?? ''}`} aria-hidden="true" />
          <span>{kindLabel(t, kind)}</span>
          <b className={styles.roomCount}>{byKind[kind] ?? 0}</b>
        </div>
      ))}
    </div>
  )
}

/** 宫殿遥测：最近 7 天 op_log 聚合（写 / 摄取 / 整理 / 闭环等计数）。 */
interface TelemetrySnapshot {
  readonly windowDays: number
  readonly counts: {
    readonly writes: number
    readonly forgets: number
    readonly ingestRequests: number
    readonly ingestDones: number
    readonly distillRequests: number
    readonly consolidations: number
  }
}

/**
 * 宫殿总览取数：规模（stats，含房间分布）+ 近 7 天活动（telemetry）+ 健康分（health）
 * 一次并行拉齐，供今日速览、健康分构成与房间目录共用（同一路由不重复请求）。
 * @param scope - 当前观察的宫殿（跟随 Header 三宫格）。
 * @param project - 项目宫殿选择器（仅用于选择器变化时重载；实际注入在 api() 里做）。
 * @returns 各段数据与取数失败原因（失败时保留上一次成功值）。
 */
function usePalaceOverview(scope: 'user' | 'project' | 'shared', project: string | null): {
  stats: StatsPart['stats'] | null
  byKind: Readonly<Record<string, number>>
  telemetry: TelemetrySnapshot | null
  health: HealthReport | null
  failed: string | null
} {
  const [state, setState] = useState<{
    stats: StatsPart['stats'] | null
    byKind: Readonly<Record<string, number>>
    telemetry: TelemetrySnapshot | null
    health: HealthReport | null
    failed: string | null
  }>({ stats: null, byKind: {}, telemetry: null, health: null, failed: null })
  useEffect(() => {
    let cancelled = false
    Promise.all([
      // stats 带 scope：project 时经 api() 注入选择器，host 让 project 段按选择器解析（缺省行为不变）。
      api<{ parts: StatsPart[] }>(`stats?scope=${scope}`),
      api<TelemetrySnapshot>(`telemetry?days=7&scope=${scope}`),
      api<HealthReport>(`health?scope=${scope}`),
    ])
      .then(([statRes, tele, health]) => {
        if (cancelled) return
        const stats = statRes.parts.find(part => part.scope === scope)?.stats ?? null
        setState({ stats, byKind: stats?.byKind ?? {}, telemetry: tele, health, failed: null })
      })
      .catch((error: Error) => {
        if (!cancelled) setState(current => ({ ...current, failed: error.message }))
      })
    return () => { cancelled = true }
  }, [scope, project])
  return state
}

/**
 * 今日速览：三个主指标（记忆 / 开放 / 清晰度）+ 近 7 天三个次级计数 + 健康分环。
 * 取代原先常驻的九格日报条——主次分层，其余计数下沉到「管家日志」tab。
 */
function TodayHero({ t, overview, dueCount }: { t: T; overview: ReturnType<typeof usePalaceOverview>; dueCount: number }): React.ReactElement {
  const { stats, telemetry, health, failed } = overview
  if (failed !== null) {
    return <section className={styles.panelCard}><div className={styles.expandLoading}>{t('teleFailed')}：{failed}</div></section>
  }
  if (telemetry === null) {
    return <section className={styles.panelCard}><div className={styles.expandLoading}>{t('teleLoading')}</div></section>
  }
  const counts = telemetry.counts
  return (
    <section className={styles.panelCard}>
      <div className={styles.hero}>
        <div className={styles.heroMetrics}>
          <Metric label={t('kpiTotal')} value={stats?.total ?? 0}
            tail={`${t('teleGroupRecent')} +${String(counts.writes)}`} />
          <Metric label={t('kpiActive')} value={stats?.active ?? 0}
            tail={`${t('kpiForgotten')} ${String(stats?.forgotten ?? 0)}`} />
          <Metric label={t('kpiSignal')} value={`${String(Math.round((stats?.signalRatio ?? 0) * 100))}%`}
            tail={t('cardRedacted', { n: stats?.redacted ?? 0 })} />
        </div>
        <div className={styles.heroSide}>
          <Metric label={t('teleWrites')} value={counts.writes} secondary />
          <Metric label={t('teleIngest')} value={counts.ingestRequests} secondary />
          <Metric label={t('teleConsolidate')} value={counts.consolidations} secondary />
          {/* 今日到期：复习调度的消费者是 agent，这里只给观测计数（角标/陈展筛选可达）。 */}
          <Metric label={t('heroDue')} value={dueCount} secondary />
          <HealthRing score={health?.overall ?? 0} />
        </div>
      </div>
      <div className={styles.heroFoot}>
        <span className={styles.sectionHint}>
          {health === null ? t('healthLoading') : t('healthEvaluatedAt', { time: relTime(t, health.evaluatedAt) })}
        </span>
        {/* 隐私元数据：叹号图标 + 短标签 + hover/聚焦弹出长说明。 */}
        <span className={styles.telePrivacy} role="note" aria-label={t('telePrivacyHint')} tabIndex={0}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
            <line x1="7" y1="6" x2="7" y2="10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <circle cx="7" cy="4.2" r="0.7" fill="currentColor"/>
          </svg>
          <span className={styles.telePrivacyHint}>{t('telePrivacyHint')}</span>
          <span className={styles.telePrivacyTip} role="tooltip">{t('telePrivacyTip')}</span>
        </span>
      </div>
    </section>
  )
}

/** 历史回填 API 的估算结构（GET /api/dsh/engram/history-backfill）。 */
interface BackfillEstimateView {
  readonly rules: {
    readonly days: number
    readonly maxTurnsPerSession: number
    readonly maxTotalTurns: number
    readonly includeSubagents: boolean
    readonly includeSeeded: boolean
    readonly includeNoCwd: boolean
  }
  readonly candidates: number
  readonly eligibleTurns: number
  readonly pendingTurns: number
  readonly alreadyIngested: number
  readonly skipped: {
    readonly subagent: number
    readonly seeded: number
    readonly noCwd: number
    readonly tooOld: number
    readonly unreadable: number
  }
  readonly truncated: boolean
  readonly unavailable?: string
}

/** 宿主已注册的 provider 与模型清单（GET /api/dsh/engram/models）。 */
interface ModelsView {
  readonly providers: readonly { readonly id: string; readonly name: string; readonly models: readonly { readonly id: string; readonly name: string }[] }[]
  readonly failures: readonly string[]
}

/** 历史回填任务状态（GET /api/dsh/engram/history-backfill/status）。 */
interface BackfillStatusView {
  readonly progress: {
    readonly state: 'running' | 'done' | 'cancelled' | 'failed'
    readonly sessionsTotal: number
    readonly sessionsDone: number
    readonly turnsPlanned: number
    readonly turnsDone: number
    readonly memoriesWritten: number
    readonly turnsSkipped: number
    readonly turnsFailed: number
    readonly skipReasons: Readonly<Record<string, number>>
    readonly currentSession?: string
  }
  readonly failures: readonly { readonly sessionId: string; readonly turn: number; readonly reason: string }[]
  readonly error?: string
}

/** 跳过原因（摄取管线的英文枚举）→ 词典键。 */
const SKIP_KEY: Record<string, EngramKey> = {
  'low-activity': 'skipLowActivity',
  chitchat: 'skipChitchat',
  'capture-forbidden': 'skipForbidden',
  'no-user-content': 'skipNoContent',
  'already-ingested': 'skipAlready',
  'no-such-turn': 'skipNoTurn',
  'no-previous-turn': 'skipNoTurn',
  'no-route-in-log': 'skipNoRoute',
  unparsable: 'skipUnparsable',
}

/** 跳过原因的本地化标签（未知枚举回退原值）。 */
function skipLabel(t: T, reason: string): string {
  const key = SKIP_KEY[reason]
  return key === undefined ? reason : t(key)
}

/**
 * 历史回填：导入规则由用户选择（时间窗 / 轮数上限 / 三类会话过滤），
 * 先估算（零成本）再执行；运行中每 1.5 秒轮询进度，可暂停续做。
 */
function HistoryBackfillCard({ t, toast }: { t: T; toast: ToastController }): React.ReactElement {
  /** 规则（持久化）：时间窗与过滤开关以字符串存，便于 localStorage 往返。 */
  const [days, setDays] = usePersistedState<string>('backfill.days', '7', ['7', '30', '90', '0'])
  const [maxTurns, setMaxTurns] = usePersistedString('backfill.maxTurns', '20')
  const [maxTotal, setMaxTotal] = usePersistedString('backfill.maxTotal', '200')
  const [subagents, setSubagents] = usePersistedState<string>('backfill.subagents', 'false', ['false', 'true'])
  const [seeded, setSeeded] = usePersistedState<string>('backfill.seeded', 'false', ['false', 'true'])
  const [noCwd, setNoCwd] = usePersistedState<string>('backfill.noCwd', 'false', ['false', 'true'])
  /** 辅助模型选择：'' = 自动（用当前在用的模型）；否则 `provider::model`。 */
  const [modelChoice, setModelChoice] = usePersistedString('backfill.model', '')
  const [models, setModels] = useState<ModelsView | null>(null)
  const [estimate, setEstimate] = useState<BackfillEstimateView | null>(null)
  const [status, setStatus] = useState<BackfillStatusView | null>(null)
  const [busy, setBusy] = useState(false)

  // 已注册模型清单：只拉一次（模型注册表变化不频繁，切换 tab 会重新挂载）。
  useEffect(() => {
    let cancelled = false
    api<ModelsView>('models')
      .then((data) => { if (!cancelled) setModels(data) })
      .catch(() => { if (!cancelled) setModels({ providers: [], failures: [] }) })
    return () => { cancelled = true }
  }, [])

  /** 显式选中的辅助模型（未选 = 交给后端用当前在用的模型）。 */
  const selection = ((): { provider: string; model: string } | undefined => {
    if (modelChoice === '') return undefined
    const separator = modelChoice.indexOf('::')
    if (separator <= 0) return undefined
    return { provider: modelChoice.slice(0, separator), model: modelChoice.slice(separator + 2) }
  })()

  const params = new URLSearchParams({
    days, maxTurnsPerSession: maxTurns, maxTotalTurns: maxTotal,
    includeSubagents: subagents, includeSeeded: seeded, includeNoCwd: noCwd,
  })
  if (selection !== undefined) {
    params.set('provider', selection.provider)
    params.set('model', selection.model)
  }
  const query = params.toString()

  const reload = useCallback((): void => {
    setBusy(true)
    api<{ estimate: BackfillEstimateView }>(`history-backfill?${query}`)
      .then((data) => { setEstimate(data.estimate) })
      .catch((error: Error) => { toast.push('error', error.message) })
      .finally(() => { setBusy(false) })
  }, [query, toast])
  useEffect(() => { reload() }, [reload])

  // 进度轮询：运行中每 1.5 秒一次；空闲只拉一次拿最终态。
  const running = status?.progress.state === 'running'
  useEffect(() => {
    let cancelled = false
    const poll = (): void => {
      api<BackfillStatusView>('history-backfill/status')
        .then((data) => { if (!cancelled) setStatus(data) })
        .catch(() => { /* 轮询失败静默重试，不打断面板 */ })
    }
    poll()
    if (!running) return () => { cancelled = true }
    const timer = window.setInterval(poll, 1500)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [running])

  const start = (): void => {
    setBusy(true)
    api<{ ok: boolean; status: BackfillStatusView }>('history-backfill/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        days: Number(days), maxTurnsPerSession: Number(maxTurns), maxTotalTurns: Number(maxTotal),
        includeSubagents: subagents === 'true', includeSeeded: seeded === 'true', includeNoCwd: noCwd === 'true',
        ...(selection === undefined ? {} : { provider: selection.provider, model: selection.model }),
      }),
    })
      .then((data) => { setStatus(data.status) })
      .catch((error: Error) => { toast.push('error', error.message) })
      .finally(() => { setBusy(false) })
  }
  const pause = (): void => {
    api<{ status: BackfillStatusView }>('history-backfill/cancel', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    })
      .then((data) => { setStatus(data.status) })
      .catch((error: Error) => { toast.push('error', error.message) })
  }

  const progress = status?.progress
  const stateLabel = progress === undefined
    ? ''
    : progress.state === 'running' ? t('backfillStateRunning')
      : progress.state === 'done' ? t('backfillStateDone')
        : progress.state === 'cancelled' ? t('backfillStateCancelled')
          : t('backfillStateFailed')
  const percent = progress === undefined || progress.turnsPlanned === 0
    ? 0
    : Math.min(100, Math.round((progress.turnsDone / progress.turnsPlanned) * 100))

  return (
    <div className={styles.backfill}>
      <p className={styles.backfillIntro}>{t('backfillIntro')}</p>

      {/* 导入规则：全部由用户选择（持久化，下次进来沿用）。 */}
      <div className={styles.backfillRules}>
        <label className={styles.backfillRule}>
          <span>{t('backfillDays')}</span>
          <select className={styles.input} value={days} onChange={event => { setDays(event.target.value) }}>
            <option value="7">{t('backfillDaysUnit', { n: 7 })}</option>
            <option value="30">{t('backfillDaysUnit', { n: 30 })}</option>
            <option value="90">{t('backfillDaysUnit', { n: 90 })}</option>
            <option value="0">{t('backfillDaysAll')}</option>
          </select>
        </label>
        <label className={styles.backfillRule}>
          <span>{t('backfillMaxTurns')}</span>
          <input className={styles.input} type="number" min={1} max={500} value={maxTurns}
            onChange={event => { setMaxTurns(event.target.value) }} />
        </label>
        <label className={styles.backfillRule}>
          <span>{t('backfillMaxTotal')}</span>
          <input className={styles.input} type="number" min={1} max={5000} value={maxTotal}
            onChange={event => { setMaxTotal(event.target.value) }} />
        </label>
        {/* 辅助模型：默认「自动」= 回填时用你当前在用的模型（历史日志里的旧模型可能已不可用）。 */}
        <label className={styles.backfillRule}>
          <span>{t('backfillModel')}</span>
          <select className={styles.input} value={modelChoice}
            onChange={event => { setModelChoice(event.target.value) }}>
            <option value="">{t('backfillModelAuto')}</option>
            {(models?.providers ?? []).map(provider => (
              <optgroup key={provider.id} label={provider.name}>
                {provider.models.map(model => (
                  <option key={`${provider.id}::${model.id}`} value={`${provider.id}::${model.id}`}>{model.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.backfillToggles}>
        <label className={styles.backfillToggle}>
          <input type="checkbox" checked={subagents === 'true'}
            onChange={event => { setSubagents(event.target.checked ? 'true' : 'false') }} />
          {t('backfillIncludeSubagents')}
        </label>
        <label className={styles.backfillToggle}>
          <input type="checkbox" checked={seeded === 'true'}
            onChange={event => { setSeeded(event.target.checked ? 'true' : 'false') }} />
          {t('backfillIncludeSeeded')}
        </label>
        <label className={styles.backfillToggle}>
          <input type="checkbox" checked={noCwd === 'true'}
            onChange={event => { setNoCwd(event.target.checked ? 'true' : 'false') }} />
          {t('backfillIncludeNoCwd')}
        </label>
      </div>

      {/* 估算：零成本先看数（不写库、不调 LLM）。 */}
      <div className={styles.backfillEstimate}>
        {estimate === null
          ? <span className={styles.backfillMuted}>{t('backfillEstimating')}</span>
          : estimate.unavailable !== undefined
            ? <span className={styles.backfillMuted}>{estimate.unavailable}</span>
            : (
              <>
                <div className={styles.backfillNumbers}>
                  <span className={styles.backfillMetric}>{t('backfillCandidates', { n: estimate.candidates })}</span>
                  <span className={styles.backfillMetric}>{t('backfillPendingTurns', { n: estimate.pendingTurns })}</span>
                  <span className={styles.backfillMetric}>{t('backfillAlready', { n: estimate.alreadyIngested })}</span>
                </div>
                <div className={styles.backfillMuted}>
                  {t('backfillSkippedDetail', {
                    subagent: estimate.skipped.subagent,
                    seeded: estimate.skipped.seeded,
                    noCwd: estimate.skipped.noCwd,
                    tooOld: estimate.skipped.tooOld,
                    unreadable: estimate.skipped.unreadable,
                  })}
                </div>
                {estimate.truncated && <div className={styles.backfillMuted}>{t('backfillTruncated')}</div>}
              </>
            )}
      </div>

      <div className={styles.backfillActions}>
        <button type="button" className={styles.button} disabled={busy} onClick={reload}>{t('backfillReestimate')}</button>
        <button type="button" className={`${styles.button} ${styles.primary}`}
          disabled={busy || running || estimate === null || estimate.unavailable !== undefined || estimate.pendingTurns === 0}
          onClick={start}>{t('backfillStart')}</button>
        <button type="button" className={styles.button} disabled={!running} onClick={pause}>{t('backfillPause')}</button>
      </div>
      {progress !== undefined && (
        <div className={styles.backfillProgress}>
          <div className={styles.backfillProgressHead}>
            <span>{stateLabel}</span>
            <span>{t('backfillProgressTurns', { done: progress.turnsDone, total: progress.turnsPlanned })}</span>
          </div>
          <div className={styles.progressBar}><i style={{ width: `${String(percent)}%` }} /></div>
          <div className={styles.backfillMeta}>
            <span>{t('backfillProgressSessions', { done: progress.sessionsDone, total: progress.sessionsTotal })}</span>
            <span>{t('backfillWritten', { n: progress.memoriesWritten })}</span>
            <span>{t('backfillTurnsSkipped', { n: progress.turnsSkipped })}</span>
            <span>{t('backfillTurnsFailed', { n: progress.turnsFailed })}</span>
          </div>
          {/* 跳过原因分布：让「写入很少」可解释（多为节流跳过而非失败）。 */}
          {Object.keys(progress.skipReasons).length > 0 && (
            <div className={styles.backfillMeta}>
              <span>{t('backfillSkipReasons')}</span>
              {Object.entries(progress.skipReasons).sort(([, a], [, b]) => b - a).map(([reason, count]) => (
                <span key={reason}>{`${skipLabel(t, reason)} ${String(count)}`}</span>
              ))}
            </div>
          )}
          {(status?.failures ?? []).length > 0 && (
            <ul className={styles.backfillFailures}>
              <li className={styles.backfillMuted}>{t('backfillFailures')}</li>
              {status!.failures.slice(0, 3).map((failure, index) => (
                <li key={`${failure.sessionId}-${String(failure.turn)}-${String(index)}`}>
                  {`${failure.sessionId.slice(-12)} · ${String(failure.turn)} · ${failure.reason}`}
                </li>
              ))}
            </ul>
          )}
          {(status?.failures ?? []).length > 0 && (
            <div className={styles.backfillMuted}>{t('backfillRouteHint')}</div>
          )}
          {status?.error !== undefined && <div className={styles.backfillMuted}>{status.error}</div>}
        </div>
      )}
    </div>
  )
}

/** Jev 面板视图（GET/POST /api/dsh/engram/jev-config 的响应体；密钥只有掩码，明文不出进程）。 */
interface JevPanelView {
  readonly enabled: boolean
  readonly apiKeySet: boolean
  readonly apiKeyMask: string | null
  readonly baseUrl: string
  readonly model: string
  readonly timeoutMs: number
  readonly deferMergeAbove: number
  readonly deferAcceptBelow: number
  readonly contradictMinProbability: number
}

/**
 * Jev 裁决配置：面板覆盖 cordis.yml 的连接字段（开关 / 密钥 / 端点 / 模型 / 超时），
 * 保存进 `<dbDir>/jev-config.json`（0600）后立即生效，无需重启。密钥输入框只进不出
 * （placeholder 回显掩码）；留空 = 保留现有覆盖，清除走「清除已存密钥」。
 */
function JevConfigCard({ t, toast }: { t: T; toast: ToastController }): React.ReactElement {
  const [view, setView] = useState<JevPanelView | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [timeoutMs, setTimeoutMs] = useState('3000')
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)

  // 初载：视图只读展示 + 表单初始值；密钥不回填输入框（保持空 = 不改动）。
  useEffect(() => {
    let cancelled = false
    api<JevPanelView>('jev-config')
      .then((data) => {
        if (cancelled) return
        setView(data)
        setEnabled(data.enabled)
        setBaseUrl(data.baseUrl)
        setModel(data.model)
        setTimeoutMs(String(data.timeoutMs))
      })
      .catch((error: Error) => { if (!cancelled) toast.push('error', `${t('jevLoadFailed')}: ${error.message}`) })
    return () => { cancelled = true }
  }, [t, toast])

  const save = (): void => {
    setBusy(true)
    api<{ ok: boolean; view: JevPanelView }>('jev-config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // 密钥留空 = 不发送该字段（保留现有覆盖）；清空语义走 clearKey。
      body: JSON.stringify({
        enabled,
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        timeoutMs: Number(timeoutMs),
        ...(apiKey.trim() === '' ? {} : { apiKey: apiKey.trim() }),
      }),
    })
      .then((data) => {
        setView(data.view)
        setApiKey('')
        toast.push('success', t('jevSaved'))
      })
      .catch((error: Error) => { toast.push('error', error.message) })
      .finally(() => { setBusy(false) })
  }

  const clearKey = (): void => {
    setBusy(true)
    api<{ ok: boolean; view: JevPanelView }>('jev-config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // 空串 = 清除面板密钥覆盖，回落 cordis.yml 的值。
      body: JSON.stringify({ apiKey: '' }),
    })
      .then((data) => { setView(data.view); toast.push('success', t('jevKeyCleared')) })
      .catch((error: Error) => { toast.push('error', error.message) })
      .finally(() => { setBusy(false) })
  }

  // 连接测试：用当前输入值（不落覆盖文件）发最小 ping 问题；密钥留空 = 测已存值。
  const testConnection = (): void => {
    setTesting(true)
    api<{ ok: boolean; elapsedMs: number; probability: number | undefined; error: string | undefined }>('jev-test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        ...(apiKey.trim() === '' ? {} : { apiKey: apiKey.trim() }),
      }),
    })
      .then((result) => {
        if (result.ok) toast.push('success', t('jevTestOk', { ms: result.elapsedMs, p: result.probability }))
        else toast.push('error', t('jevTestFail', { error: result.error ?? '' }))
      })
      .catch((error: Error) => { toast.push('error', error.message) })
      .finally(() => { setTesting(false) })
  }

  if (view === null) return <span className={styles.jevMuted}>{t('loading')}</span>

  return (
    <div className={styles.jev}>
      <p className={styles.jevIntro}>{t('jevIntro')}</p>
      <div className={styles.jevToggleRow}>
        <label className={styles.jevToggle}>
          <input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} />
          {t('jevEnabled')}
        </label>
        <span className={styles.jevStatus}>{view.enabled ? t('jevStatusOn') : t('jevStatusOff')}</span>
      </div>
      <div className={styles.jevForm}>
        <label className={styles.jevField}>
          <span>{t('jevApiKey')}</span>
          <input className={styles.input} type="password" value={apiKey} autoComplete="off"
            placeholder={view.apiKeyMask ?? t('jevApiKeyUnset')}
            onChange={event => setApiKey(event.target.value)} />
          <span className={styles.jevMuted}>{t('jevApiKeyHint')}</span>
        </label>
        <label className={styles.jevField}>
          <span>{t('jevBaseUrl')}</span>
          <input className={styles.input} value={baseUrl} onChange={event => setBaseUrl(event.target.value)} />
        </label>
        <label className={styles.jevField}>
          <span>{t('jevModel')}</span>
          <input className={styles.input} value={model} onChange={event => setModel(event.target.value)} />
        </label>
        <label className={styles.jevField}>
          <span>{t('jevTimeoutMs')}</span>
          <input className={styles.input} type="number" min={1000} max={60000} value={timeoutMs}
            onChange={event => setTimeoutMs(event.target.value)} />
        </label>
      </div>
      <div className={styles.jevMuted}>{t('jevThresholdsTitle')}</div>
      <div className={styles.jevMuted}>{t('jevThresholdLine', {
        merge: view.deferMergeAbove,
        accept: view.deferAcceptBelow,
        contradict: view.contradictMinProbability,
      })}</div>
      <div className={styles.jevActions}>
        <button type="button" className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={save}>
          {t('jevSave')}
        </button>
        <button type="button" className={styles.button} disabled={busy || testing} onClick={testConnection}>
          {t('jevTest')}
        </button>
        {view.apiKeySet && (
          <button type="button" className={styles.button} disabled={busy} onClick={clearKey}>
            {t('jevClearKey')}
          </button>
        )}
      </div>
    </div>
  )
}

/** 近期裁决观测行视图（GET /api/dsh/engram/jev-observations 的 items 元素）。 */
interface JevObservationView {
  readonly at: number
  readonly site: 'band' | 'contradiction'
  readonly question: string
  readonly answered: boolean
  readonly probability: number | undefined
  readonly elapsedMs: number
  readonly error: string | undefined
  readonly verdict: 'merge' | 'accept' | 'defer' | 'confirm' | 'reject' | 'fallback'
}

/** verdict → 徽标文案键（动态模板字符串在 EngramKey union 下不可静态检查，改用映射表）。 */
const VERDICT_KEY: Readonly<Record<JevObservationView['verdict'], EngramKey>> = {
  merge: 'jevObsVerdictMerge',
  accept: 'jevObsVerdictAccept',
  defer: 'jevObsVerdictDefer',
  confirm: 'jevObsVerdictConfirm',
  reject: 'jevObsVerdictReject',
  fallback: 'jevObsVerdictFallback',
}

/**
 * 近期裁决观测：轮询 /api/dsh/engram/jev-observations（1.5s），展示判定结果 / Jev 是否给出答案 /
 * 耗时 / 回落原因，帮助排查「这条为什么被搁置」。数据只存进程内存，重启清空。
 */
function JevObservationsCard({ t, toast }: { t: T; toast: ToastController }): React.ReactElement {
  const [items, setItems] = useState<readonly JevObservationView[] | null>(null)

  useEffect(() => {
    let cancelled = false
    // 初载失败弹 toast；轮询失败静默重试（观测卡不值得刷屏打扰）。
    const reload = (reportFailure: boolean): void => {
      api<{ items: readonly JevObservationView[] }>('jev-observations')
        .then((data) => { if (!cancelled) setItems(data.items) })
        .catch((error: Error) => {
          if (cancelled) return
          setItems(previous => previous ?? [])
          if (reportFailure) toast.push('error', `${t('jevObsLoadFailed')}: ${error.message}`)
        })
    }
    reload(true)
    const timer = window.setInterval(() => reload(false), 1500)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [t, toast])

  if (items === null) return <span className={styles.jevMuted}>{t('loading')}</span>
  if (items.length === 0) return <span className={styles.jevMuted}>{t('jevObsEmpty')}</span>

  return (
    <div className={styles.jevObs}>
      <div className={styles.jevObsHead}>{t('jevObsTitle')}</div>
      {items.map((item, index) => (
        <div key={`${item.at}-${item.site}-${index}`} className={styles.jevObsItem}>
          <span className={styles.jevObsTime}>{new Date(item.at).toLocaleTimeString()}</span>
          <span>{item.site === 'band' ? t('jevObsSiteBand') : t('jevObsSiteContradiction')}</span>
          <span className={item.verdict === 'fallback'
            ? styles.jevObsBadgeWarn
            : item.verdict === 'confirm' || item.verdict === 'merge' ? styles.jevObsBadgeGood : styles.jevObsBadge}>
            {t(VERDICT_KEY[item.verdict])}
          </span>
          <span>{item.answered ? `p=${item.probability?.toFixed(3)}` : t('jevObsNoAnswer')}</span>
          <span>{item.elapsedMs}ms</span>
          {item.error !== undefined && <span className={styles.jevObsError}>{t('jevObsErrorLine', { error: item.error })}</span>}
        </div>
      ))}
    </div>
  )
}

/** 导出下拉：把三种格式（Markdown / JSON / 镜像目录）合并成一个按钮 + 弹出列表。
 *  链接是浏览器直连的 GET（不走 api()），故这里显式拼接项目宫殿选择器。 */
function ExportMenu({ t, scope, project }: {
  t: T
  scope: 'user' | 'project' | 'shared'
  /** 项目宫殿选择器：仅在 project 作用域拼接（null = 服务端走进程默认库）。 */
  project: string | null
}): React.ReactElement {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const handler = (event: MouseEvent): void => {
      if (wrapRef.current === null || !wrapRef.current.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', handler)
    return () => { window.removeEventListener('mousedown', handler) }
  }, [open])
  const projectQuery = scope === 'project' && project !== null ? `&project=${encodeURIComponent(project)}` : ''
  const options: Array<{ label: string; hint: string; href: string }> = [
    { label: t('exportMd'), hint: t('exportMdHint'), href: `/api/dsh/engram/export?scope=${scope}${projectQuery}&format=markdown` },
    { label: t('exportJson'), hint: t('exportJsonHint'), href: `/api/dsh/engram/export?scope=${scope}${projectQuery}&format=json` },
    { label: t('exportMirror'), hint: t('exportMirrorHint'), href: `/api/dsh/engram/mirror?scope=${scope}${projectQuery}` },
  ]
  return (
    <div className={styles.exportWrap} ref={wrapRef}>
      <button type="button" className={styles.button} aria-haspopup="menu" aria-expanded={open}
        onClick={() => { setOpen(value => !value) }}>
        {t('export')}
        <span className={styles.exportCaret} aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className={styles.exportMenu} role="menu">
          {options.map(option => (
            <a key={option.href} role="menuitem" className={styles.exportItem} href={option.href}
              onClick={() => { setOpen(false) }}>
              <span className={styles.exportItemLabel}>{option.label}</span>
              <span className={styles.exportItemHint}>{option.hint}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

/** EngramSection 的 props：渲染器给的 t（locale 席位）+ 可选取用的宿主服务。 */
export type EngramSectionProps = PropsLocale<typeof NS> & {
  /** 宿主工作区服务（缺席时 chip 显示「无工作区信息」，面板其余功能照常）。 */
  readonly workspaces?: WorkspacesLike | undefined
  /** 宿主会话清单服务（用于判定当前会话所属工作区）。 */
  readonly sessions?: SessionsLike | undefined
}

/** 设置页「记忆库」section 主组件（t 由渲染器按 locale: NS 声明合成）。 */
export function EngramSection({ t, workspaces, sessions }: EngramSectionProps): React.ReactElement {
  const toast = useToast()
  /** 全局 scope（持久化）：Header 三宫格是唯一切换器，驱动今日速览、各视图卡片、陈展列表与导出。 */
  const [scope, setScope] = usePersistedState<'user' | 'project' | 'shared'>('library.scope', 'user', ['user', 'project', 'shared'])
  /** 库顶 status / kind / q 过滤器（持久化）。 */
  const [status, setStatus] = usePersistedState<string>('library.status', 'all', ['all', 'active', 'archived', 'forgotten'])
  const [kind, setKind] = usePersistedState<string>('library.kind', 'all', ['all', 'fact', 'preference', 'decision', 'episode', 'skill'])
  const [q, setQ] = usePersistedString('library.q', '')
  /** 陈展列表排序（持久化）：time = 开馆时间倒序；tour = 固定巡游路线桩位顺序。 */
  const [sort, setSort] = usePersistedState<'time' | 'tour'>('library.sort', 'time', ['time', 'tour'])
  /** 今日到期条数与 id 集合（Header 角标 + 陈展「今日到期」筛选共用同一次拉取）。 */
  const [dueCount, setDueCount] = useState(0)
  const [dueIds, setDueIds] = useState<ReadonlySet<string>>(new Set())
  /** 陈展「今日到期」筛选：只显示复习调度今天到期的条目。 */
  const [dueOnly, setDueOnly] = useState(false)
  /** 脱敏筛选已合并到顶部 KPI 与 tag 视觉，不再作为过滤器。 */
  const [redacted] = useState('all')
  const [offset, setOffset] = useState(0)
  const [list, setList] = useState<ListResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** 行内展开态：互斥的唯一展开条目（review 或 edit）。 */
  const [expanded, setExpanded] = useState<{ kind: 'review' | 'edit'; record: MemoryRow } | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  /** 批量选择：条目 id 集合（scope/过滤/翻页/搜索变更时清空）。 */
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  /** 批量遗忘的两段式确认。 */
  const [confirmForget, setConfirmForget] = useState(false)
  /** Tab 视图：today 今日速览 / library 陈展列表 / corridor 走廊与检索 / episodes 往事时间线 / entities 实体词典 / log 管家日志 / backfill 历史回填 / jev Jev 裁决配置。 */
  const [activeTab, setActiveTab] = useState<'today' | 'library' | 'corridor' | 'episodes' | 'entities' | 'log' | 'backfill' | 'jev'>('today')
  /** 项目宫殿来源（持久化）：'follow' = 跟随 GUI 当前工作区；其它值 = 固定的 host 分库 dbName。 */
  const [projectMode, setProjectMode] = usePersistedString('library.project', 'follow')
  /** GUI 当前工作区（与侧边栏同一判定）与 host 的项目宫殿清单。 */
  const currentWorkspace = useCurrentWorkspace(workspaces, sessions)
  const [workspaceList, setWorkspaceList] = useState<EngramWorkspacesView | null>(null)
  const workspaceId = currentWorkspace.workspace?.workspaceId ?? ''

  /** 拉取 host 项目宫殿清单（挂载 / 工作区切换 / 固定值变化 / 手动重访）：失败静默，只影响标签与下拉。 */
  useEffect(() => {
    let cancelled = false
    api<EngramWorkspacesView>('workspaces')
      .then((data) => { if (!cancelled) setWorkspaceList(data) })
      .catch(() => { /* 清单失败保持上一次：选择器本身仍可工作（跟随退化为进程默认） */ })
    return () => { cancelled = true }
  }, [workspaceId, projectMode, reloadTick])

  /** 跟随目标：GUI 当前工作区在 host 清单里对应的项目库（匹配不到 = 进程默认库）。 */
  const followedProject = matchFollowTarget(workspaceList, currentWorkspace.workspace)
  /** 实际选择器：follow + 已知工作区 → 该工作区分库；follow + 未知 → null（不注入）。 */
  const projectSelector = projectMode === 'follow' ? followedProject?.dbName ?? null : projectMode
  // 渲染期挂到 api() 的注入点：父先渲染，保证子组件 effect 的首批请求已带上选择器。
  activeProjectSelector = projectSelector
  /** Header chip 的四态文案（固定 / 跟随 / 未注册 / 无工作区信息）。 */
  const chip = projectChip(t, {
    mode: projectMode,
    available: currentWorkspace.available,
    items: workspaceList?.items ?? [],
    followed: followedProject,
    processDefaultPath: workspaceList?.processDefault?.path ?? null,
  })
  /** 固定的 dbName 不在 host 清单里（工作区被删除 / 只从会话 cwd 见过）：下拉补一项避免选中态丢失。 */
  const pinnedMissing = projectMode !== 'follow'
    && !(workspaceList?.items ?? []).some(item => item.dbName === projectMode)

  /** 今日速览、健康分构成与房间目录共用一份总览数据（同一路由不重复请求）。 */
  const overview = usePalaceOverview(scope, projectSelector)

  const reload = useCallback((): void => { setReloadTick(tick => tick + 1) }, [])

  /** 失效选择器的自愈：同一轮只触发一次，回到 follow 后复位（见 api() 的 404 分支）。 */
  const healingRef = useRef(false)
  useEffect(() => {
    healDeadProject = (): void => {
      // 只在「固定到某个已失效分库」时自愈；跟随态 404 说明 host 清单与分库不一致，回退只会抖动。
      if (healingRef.current || projectMode === 'follow') return
      healingRef.current = true
      setProjectMode('follow')
      setOffset(0)
      setExpanded(null)
      setSelected(new Set())
      reload()
    }
    return () => { healDeadProject = null }
  }, [projectMode, reload])
  useEffect(() => {
    if (projectMode === 'follow') healingRef.current = false
  }, [projectMode])

  /** 刷新今日到期计数与 id 集合（本地回环毫秒级；失败静默归零，不打断面板）。 */
  const refreshDue = useCallback((): void => {
    api<{ items: readonly { id: string }[] }>(`review-due?scope=${scope}&limit=50`)
      .then(data => {
        setDueCount(data.items.length)
        setDueIds(new Set(data.items.map(item => item.id)))
      })
      .catch(() => { setDueCount(0); setDueIds(new Set()) })
  }, [scope, projectSelector])
  useEffect(() => { refreshDue() }, [refreshDue])

  /** 角标点击：切到宫殿陈展并启用「今日到期」筛选（复习调度的消费者是 agent，面板只做观测）。 */
  const goToDue = (): void => {
    setActiveTab('library')
    setDueOnly(true)
  }

  /** 打开详情抽屉：陈展列表已有该行时复用真实行，只有 id 的列表用最小占位行（抽屉自行拉 review）。 */
  const openReview = useCallback((id: string): void => {
    const record = list?.records.find(row => row.id === id)
    setExpanded({
      kind: 'review',
      record: record ?? ({
        id: id as never, scope, kind: 'fact', content: '', importance: 0.5, confidence: 0.5,
        status: 'active', createdAt: Date.now(), accessCount: 0, sourceSessionId: null, sourceRound: null,
      } as MemoryRow),
    })
  }, [list, scope])

  useEffect(() => {
    let cancelled = false
    const qs = new URLSearchParams({
      scope, status, kind, redacted, limit: String(PAGE_SIZE), offset: String(offset),
    })
    if (q !== '') qs.set('q', q)
    if (sort === 'tour') qs.set('sort', 'tour')
    api<ListResult>(`list?${qs.toString()}`)
      .then((data) => { if (!cancelled) { setList(data); setError(null) } })
      .catch((loadError: Error) => { if (!cancelled) setError(loadError.message) })
    return () => { cancelled = true }
  }, [scope, status, kind, redacted, q, sort, offset, reloadTick, projectSelector])

  /** 项目宫殿切换（工作区切换 / 手动固定）：回到第 1 页并清掉跨库无意义的展开与选择态。 */
  const lastProject = useRef(projectSelector)
  useEffect(() => {
    if (lastProject.current === projectSelector) return
    lastProject.current = projectSelector
    setOffset(0)
    setExpanded(null)
    setSelected(new Set())
  }, [projectSelector])

  const act = (route: string, record: MemoryRow): void => {
    api(route, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: record.id, scope: record.scope }),
    })
      .then(reload)
      .catch((actError: Error) => { toast.push('error', actError.message) })
  }

  const toggle = (expandKind: 'review' | 'edit', record: MemoryRow): void => {
    setExpanded(current => (current !== null && current.kind === expandKind && current.record.id === record.id)
      ? null
      : { kind: expandKind, record })
  }

  const allRecords = list?.records ?? []
  // 「今日到期」筛选是页内视图过滤（复习调度今天到期的 id 白名单）；分页仍按库内全量计算。
  const pageRecords = dueOnly ? allRecords.filter(record => dueIds.has(record.id)) : allRecords
  const selectedRecords = pageRecords.filter(record => selected.has(record.id))
  const forgetable = selectedRecords.filter(record => record.status === 'active').length
  const restorable = selectedRecords.length - forgetable
  const allSelected = pageRecords.length > 0 && pageRecords.every(record => selected.has(record.id))

  const toggleSelect = (id: string): void => {
    setSelected(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clearSelection = (): void => { setSelected(new Set()); setConfirmForget(false) }

  const toggleAllPage = (): void => {
    setSelected(current => {
      const next = new Set(current)
      if (allSelected) pageRecords.forEach(record => next.delete(record.id))
      else pageRecords.forEach(record => next.add(record.id))
      return next
    })
  }

  /** 批量执行：逐条调单条 API（回环毫秒级），单条失败不阻塞其余；完成即刷新并清空选择。 */
  const runBatch = (mode: 'forget' | 'restore'): void => {
    const targets = mode === 'forget'
      ? selectedRecords.filter(record => record.status === 'active')
      : selectedRecords.filter(record => record.status !== 'active')
    if (targets.length === 0) return
    void Promise.allSettled(targets.map(target => api(mode, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: target.id, scope: target.scope }),
    }))).then(() => { clearSelection(); reload() })
  }

  const armBatchForget = (): void => {
    // 确认态保持到用户点击确认执行或清空选择，不做自动复位（3 秒窗口曾导致执行落空）。
    if (confirmForget) { runBatch('forget'); return }
    setConfirmForget(true)
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pages = list === null ? 1 : Math.max(1, Math.ceil(list.total / PAGE_SIZE))
  /** Segmented Control 玻璃指示器位置：根据选中按钮 DOM 测量。 */
  const segRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map())
  const [segIndicator, setSegIndicator] = useState<{ left: number; width: number; opacity: number }>({ left: 0, width: 0, opacity: 0 })
  const measureSeg = useCallback((): void => {
    const node = segRefs.current.get(scope)
    if (node === null || node === undefined) return
    setSegIndicator({ left: node.offsetLeft, width: node.offsetWidth, opacity: 1 })
  }, [scope])
  useEffect(() => {
    measureSeg()
    const onResize = (): void => measureSeg()
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize) }
  }, [measureSeg])

  return (
    <div className={styles.panel}>
      {/* Header：宫殿 Logo + 标题 + 简介 + 右侧动作按钮组。 */}
      <div className={styles.header}>
        <div className={styles.headerBrand}>
          <span className={styles.headerLogo} aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
              <path d="M6 20 L24 7 L42 20 Z" fill="currentColor" fillOpacity="0.9"/>
              <rect x="9" y="20" width="30" height="18" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2"/>
              <rect x="13" y="24" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6"/>
              <line x1="16" y1="24" x2="16" y2="30" stroke="currentColor" strokeWidth="1.2"/>
              <line x1="13" y1="27" x2="19" y2="27" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M21 38 L21 28 Q21 25 24 25 Q27 25 27 28 L27 38" fill="none" stroke="currentColor" strokeWidth="1.8"/>
              <rect x="29" y="24" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6"/>
              <line x1="32" y1="24" x2="32" y2="30" stroke="currentColor" strokeWidth="1.2"/>
              <line x1="29" y1="27" x2="35" y2="27" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
          </span>
          <div className={styles.headerTitle}>
            <h2>{t('headerTitle')}</h2>
            <p>{t('headerSubtitle')}</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <div className={`${styles.segGroup} ${styles.segScope}`}>
            <span className={styles.segIndicator}
              style={{ left: `${String(segIndicator.left)}px`, width: `${String(segIndicator.width)}px`, opacity: segIndicator.opacity }} />
            {(['user', 'project', 'shared'] as const).map(option => (
              <button key={option} type="button" ref={node => { segRefs.current.set(option, node) }}
                className={scope === option ? `${styles.segItem} ${styles.on}` : styles.segItem}
                onClick={() => { setScope(option); setOffset(0); setExpanded(null); clearSelection() }}>
                {t(SCOPE_KEY[option])}
              </button>
            ))}
          </div>
          {/* 今日待回忆角标：有待回忆时在 Header 一眼可见，点击直达今日视图的待回忆卡。 */}
          {dueCount > 0 && (
            <button type="button" className={styles.dueBadge}
              title={t('dueBadgeLabel', { n: dueCount })} aria-label={t('dueBadgeLabel', { n: dueCount })}
              onClick={goToDue}>
              <span className={styles.dueDot} aria-hidden="true" />
              {dueCount}
            </button>
          )}
          <button type="button" className={styles.button} onClick={() => { reload(); refreshDue() }}>{t('refresh')}</button>
          <ExportMenu t={t} scope={scope} project={projectSelector} />
        </div>
        {/* 项目宫殿来源：独占一行（flex-basis: 100%），紧贴作用域三宫格下方、Tab 栏之上——
            只在 project 作用域显示（私人/共享宫殿没有工作区概念）。chip 显示当前落在哪个工作区分库
            （跟随 / 固定 / 未注册 / 无工作区信息）、hover 给完整路径，旁边下拉可临时固定到别的项目库。 */}
        {scope === 'project' && (
          <div className={styles.wsBar}>
            <span
              className={`${styles.wsChip}${chip.tone === 'follow' ? ` ${styles.wsFollow}` : chip.tone === 'muted' ? ` ${styles.wsMuted}` : ''}`}
              title={chip.title}>
              {chip.label}
            </span>
            <select className={`${styles.input} ${styles.wsSelect}`} value={projectMode}
              aria-label={t('projectSwitch')} title={t('projectSwitch')}
              onChange={event => { setProjectMode(event.target.value); setOffset(0); setExpanded(null); clearSelection() }}>
              <option value="follow">{t('projectFollow')}</option>
              {(workspaceList?.items ?? []).map(item => (
                <option key={item.dbName} value={item.dbName}>{projectOptionLabel(t, item)}</option>
              ))}
              {pinnedMissing && (
                <option value={projectMode}>{`${shortDbName(projectMode)} · ${t('projectUnregistered')}`}</option>
              )}
            </select>
          </div>
        )}
      </div>

      {/* 顶部 Tab Bar：八个视图（今日 / 宫殿 / 走廊 / 往事 / 实体 / 日志 / 回填 / Jev；按「先管家后陈展与配置」语义排序）。
          原常驻管家日报条已收进「今日」视图的速览卡，其余计数移入「日志」。 */}
      <div className={styles.tabs} role="tablist">
        <button type="button" role="tab"
          className={activeTab === 'today' ? `${styles.tabItem} ${styles.on}` : styles.tabItem}
          aria-selected={activeTab === 'today'}
          onClick={() => { setActiveTab('today') }}>
          {t('tabToday')}
        </button>
        <button type="button" role="tab"
          className={activeTab === 'library' ? `${styles.tabItem} ${styles.on}` : styles.tabItem}
          aria-selected={activeTab === 'library'}
          onClick={() => { setActiveTab('library') }}>
          {t('tabLibrary')}
          <small>{t('tabLibraryCount', { n: list?.total ?? 0 })}</small>
        </button>
        <button type="button" role="tab"
          className={activeTab === 'corridor' ? `${styles.tabItem} ${styles.on}` : styles.tabItem}
          aria-selected={activeTab === 'corridor'}
          onClick={() => { setActiveTab('corridor') }}>
          {t('tabCorridor')}
        </button>
        <button type="button" role="tab"
          className={activeTab === 'episodes' ? `${styles.tabItem} ${styles.on}` : styles.tabItem}
          aria-selected={activeTab === 'episodes'}
          onClick={() => { setActiveTab('episodes') }}>
          {t('tabEpisodes')}
        </button>
        <button type="button" role="tab"
          className={activeTab === 'entities' ? `${styles.tabItem} ${styles.on}` : styles.tabItem}
          aria-selected={activeTab === 'entities'}
          onClick={() => { setActiveTab('entities') }}>
          {t('tabEntities')}
        </button>
        <button type="button" role="tab"
          className={activeTab === 'log' ? `${styles.tabItem} ${styles.on}` : styles.tabItem}
          aria-selected={activeTab === 'log'}
          onClick={() => { setActiveTab('log') }}>
          {t('tabLog')}
        </button>
        <button type="button" role="tab"
          className={activeTab === 'backfill' ? `${styles.tabItem} ${styles.on}` : styles.tabItem}
          aria-selected={activeTab === 'backfill'}
          onClick={() => { setActiveTab('backfill') }}>
          {t('tabBackfill')}
        </button>
        <button type="button" role="tab"
          className={activeTab === 'jev' ? `${styles.tabItem} ${styles.on}` : styles.tabItem}
          aria-selected={activeTab === 'jev'}
          onClick={() => { setActiveTab('jev') }}>
          {t('tabJev')}
        </button>
      </div>

      {activeTab === 'library' && (
        <div className={styles.tabPanel}>
          <div className={styles.sectionHead}>
            <h4 className={styles.sectionTitle}>{t('tabLibrary')}</h4>
          </div>
          {/* 工具行：搜索占主宽，状态与排序靠右；房间筛选另起一行 chips，避免六项分段挤断换行。 */}
          <div className={styles.toolbarRow}>
            <input className={`${styles.input} ${styles.search}`} placeholder={t('searchPlaceholder')} value={q}
              onChange={event => { setQ(event.target.value.trim()); setOffset(0); setExpanded(null); clearSelection() }} />
            <div className={styles.segGroup}>
              {([
                ['all', t('allStatuses')],
                ['active', t('statusActive')],
                ['archived', t('statusArchived')],
                ['forgotten', t('statusForgotten')],
              ] as const).map(([value, label]) => (
                <button key={value} type="button"
                  className={status === value ? `${styles.segItem} ${styles.on}` : styles.segItem}
                  onClick={() => { setStatus(value); setOffset(0); setExpanded(null); clearSelection() }}>
                  {label}
                </button>
              ))}
            </div>
            {/* 今日到期：复习调度今天到期的条目（消费者是 agent，这里只做观测筛选）。 */}
            <div className={styles.segGroup}>
              <button type="button" aria-pressed={dueOnly}
                className={dueOnly ? `${styles.segItem} ${styles.on}` : styles.segItem}
                onClick={() => { setDueOnly(!dueOnly); setOffset(0); setExpanded(null); clearSelection() }}>
                {t('filterDueToday')}
              </button>
            </div>
            <div className={styles.segGroup}>
              {([['time', t('sortTime')], ['tour', t('sortTour')]] as const).map(([value, label]) => (
                <button key={value} type="button"
                  className={sort === value ? `${styles.segItem} ${styles.on}` : styles.segItem}
                  onClick={() => { setSort(value); setOffset(0); setExpanded(null); clearSelection() }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.chipRow}>
            {([
              ['all', t('allKinds')],
              ...KINDS.map(option => [option, kindLabel(t, option)] as const),
            ] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={kind === value}
                className={kind === value ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                onClick={() => { setKind(value); setOffset(0); setExpanded(null); clearSelection() }}>
                {label}
              </button>
            ))}
          </div>

          {selected.size > 0 && (
            <div className={styles.batchBar}>
              <span>{t('selectedCount', { n: selected.size })}</span>
              <button type="button" className={styles.button} onClick={toggleAllPage}>
                {allSelected ? t('deselectAll') : t('selectAll')}
              </button>
              <button type="button" className={styles.button} disabled={restorable === 0}
                onClick={() => runBatch('restore')}>{t('batchRestore', { n: restorable })}</button>
              <button type="button"
                className={confirmForget ? `${styles.button} ${styles.danger}` : styles.button}
                disabled={forgetable === 0}
                onClick={armBatchForget}>
                {confirmForget ? t('batchForgetConfirm', { n: forgetable }) : t('batchForget', { n: forgetable })}
              </button>
              <button type="button" className={styles.button} onClick={clearSelection}>{t('clearSelection')}</button>
            </div>
          )}

          {error !== null && (
            <div className={styles.empty}>
              <b>{t('loadFailed', { msg: error })}</b>
              <span>{t('emptyHint')}</span>
            </div>
          )}
          {error === null && list === null && (
            <div className={styles.skeletonList}>
              {[0, 1, 2, 3].map(index => (
                <div key={index} className={styles.skeleton} style={{ animationDelay: `${String(index * 60)}ms` }}><i /><i /><i /></div>
              ))}
            </div>
          )}
          {error === null && list !== null && pageRecords.length === 0 && (
            <div className={styles.empty}>
              <b>{t('empty')}</b>
              <span>{t('emptyHint')}</span>
            </div>
          )}

          {pageRecords.length > 0 && (
            <div className={styles.itemList}>
              {pageRecords.map((record, index) => (
                <div key={record.id}
                  className={selected.has(record.id) ? `${styles.item} ${styles.selected}` : styles.item}
                  style={{ animationDelay: `${String(Math.min(index, 12) * 36)}ms` }}>
                  <input type="checkbox" className={styles.itemCheck} checked={selected.has(record.id)}
                    aria-label={record.content.slice(0, 24)} onChange={() => toggleSelect(record.id)} />
                  <div className={styles.itemBody}>
                    <div className={styles.itemTags}>
                      <span className={`${styles.pill} ${styles[`status${record.status.charAt(0).toUpperCase()}${record.status.slice(1)}`] ?? ''}`}>{t(STATUS_KEY[record.status])}</span>
                      <span className={roomPillClass(record.kind)}>{kindLabel(t, record.kind)}</span>
                      {record.slot !== undefined && (
                        <span className={styles.pill}>{record.slot.room}#{record.slot.index}</span>
                      )}
                      {record.content.includes('[REDACTED:') && (
                        <span className={`${styles.pill} ${styles.redacted}`}>{t('tagRedacted')}</span>
                      )}
                      {record.outcome !== undefined && (
                        <span className={`${styles.pill} ${record.outcome === 'success' ? styles.outcomeSuccess : styles.outcomeFailure}`}>
                          {record.outcome === 'success' ? t('tagOutcomeSuccess') : t('tagOutcomeFailure')}
                        </span>
                      )}
                      <span className={styles.itemStamp} title={fmtTime(record.createdAt)}>
                        {t(SCOPE_KEY[record.scope])} · {relTime(t, record.createdAt)}
                      </span>
                    </div>
                    <div className={styles.content}>{record.content}</div>
                    <div className={styles.itemMeta}>
                      <span><b>{t('importance')}</b> {record.importance.toFixed(2)}</span>
                      <span><b>{t('confidence')}</b> {record.confidence.toFixed(2)}</span>
                      <span>{t('accessCount', { n: record.accessCount })}</span>
                      <span>{sourceLabel(t, record)}</span>
                    </div>
                  </div>
                  <div className={styles.itemOps}>
                    <button type="button" className={styles.button}
                      onClick={() => { toggle('review', record) }}>{t('detail')}</button>
                    <button type="button" className={styles.button}
                      onClick={() => { toggle('edit', record) }}>{t('edit')}</button>
                    {record.status === 'active'
                      ? <button type="button" className={styles.button}
                          onClick={() => { act('forget', record) }}>{t('forget')}</button>
                      : <button type="button" className={styles.button}
                          onClick={() => { act('restore', record) }}>{t('restore')}</button>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={styles.pager}>
            <button type="button" className={styles.button} disabled={offset === 0} aria-label={t('prevPage')}
              onClick={() => { setOffset(Math.max(0, offset - PAGE_SIZE)); setExpanded(null); clearSelection() }}>‹</button>
            <span>{t('pagerInfo', { page, pages, total: list?.total ?? 0 })}</span>
            <button type="button" className={styles.button} disabled={list === null || offset + PAGE_SIZE >= list.total}
              aria-label={t('nextPage')}
              onClick={() => { setOffset(offset + PAGE_SIZE); setExpanded(null); clearSelection() }}>›</button>
          </div>
        </div>
      )}

      {activeTab === 'today' && (
        <div className={styles.tabPanel}>
          {/* 今日速览：主指标 + 健康环，替代原常驻日报条。 */}
          <TodayHero t={t} overview={overview} dueCount={dueCount} />
          <div className={styles.layout}>
            {/* 左：入殿导航（进宫的入口）；右：房间目录 + 翻新清单（要看的与要做的）。
                今日到期不再单独成卡：消费者是 agent（review 工具链），面板只在速览条显示计数、在陈展提供筛选。 */}
            <div className={styles.mainCol}>
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <h4 className={styles.sectionTitle}>{t('tourProposalTitle')}</h4>
                </div>
                <div className={styles.panelCard}>
                  <TourProposalCard t={t} scope={scope} project={projectSelector} onSelect={openReview} />
                </div>
              </section>
            </div>
            <aside className={styles.sideCol}>
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <h4 className={styles.sectionTitle}>{t('profileTitle')}</h4>
                </div>
                <div className={styles.panelCard}>
                  <ProfileCard t={t} scope={scope} project={projectSelector} />
                </div>
              </section>
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <h4 className={styles.sectionTitle}>{t('roomsTitle')}</h4>
                  <span className={styles.sectionHint}>{t('roomsHint')}</span>
                </div>
                <div className={styles.panelCard}>
                  <RoomDirectory t={t} byKind={overview.byKind} />
                </div>
              </section>
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <h4 className={styles.sectionTitle}>{t('refurbTitle')}</h4>
                </div>
                <div className={styles.panelCard}>
                  <RefurbCard t={t} scope={scope} project={projectSelector} onSelect={openReview} onAfterAction={reload} toast={toast} />
                </div>
              </section>
            </aside>
          </div>
        </div>
      )}

      {activeTab === 'corridor' && (
        <div className={styles.tabPanel}>
          {/* 纵向堆叠：先看走廊结构（鸟瞰），再进检索实验台；两块都吃满宽度，图与命中行不被压窄。 */}
          <div className={styles.mainCol}>
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h4 className={styles.sectionTitle}>{t('sectionCorridor')}</h4>
              </div>
              <div className={styles.panelCard}>
                <CorridorPanel t={t} scope={scope} project={projectSelector} onSelect={openReview} />
              </div>
            </section>
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h4 className={styles.sectionTitle}>{t('benchTitle')}</h4>
                <span className={styles.sectionHint}>{t('benchNote')}</span>
              </div>
              <div className={styles.panelCard}>
                <RecallBench t={t} scope={scope} />
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'episodes' && (
        <div className={styles.tabPanel}>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h4 className={styles.sectionTitle}>{t('tabEpisodes')}</h4>
              <span className={styles.sectionHint}>{t('episodeHint')}</span>
            </div>
            <EpisodeTimelineView t={t} scope={scope} project={projectSelector} reloadTick={reloadTick} />
          </section>
        </div>
      )}

      {activeTab === 'entities' && (
        <div className={styles.tabPanel}>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h4 className={styles.sectionTitle}>{t('tabEntities')}</h4>
              <span className={styles.sectionHint}>{t('entityHint')}</span>
            </div>
            <EntityView t={t} scope={scope} project={projectSelector} reloadTick={reloadTick} />
          </section>
        </div>
      )}

      {activeTab === 'log' && (
        <div className={styles.tabPanel}>
          <LogPanel t={t} telemetry={overview.telemetry} project={projectSelector} />
        </div>
      )}

      {activeTab === 'backfill' && (
        <div className={styles.tabPanel}>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h4 className={styles.sectionTitle}>{t('backfillRulesTitle')}</h4>
            </div>
            <div className={styles.panelCard}>
              <HistoryBackfillCard t={t} toast={toast} />
            </div>
          </section>
        </div>
      )}

      {activeTab === 'jev' && (
        <div className={styles.tabPanel}>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h4 className={styles.sectionTitle}>{t('tabJev')}</h4>
            </div>
            <div className={styles.panelCard}>
              <JevConfigCard t={t} toast={toast} />
            </div>
          </section>
          <section className={styles.section}>
            <div className={styles.panelCard}>
              <JevObservationsCard t={t} toast={toast} />
            </div>
          </section>
        </div>
      )}

      {/* Drawer：行内展开升级为右滑入聚焦态，避免列表被展开压塌。 */}
      {expanded !== null && (
        <>
          <div className={styles.drawerScrim} onClick={() => { setExpanded(null) }} />
          <aside className={styles.drawer} role="dialog" aria-label={t('drawerTitle')}>
            <header className={styles.drawerHead}>
              <div className={styles.drawerTitle}>
                <h3>{t('drawerTitle')}</h3>
                <span title={expanded.record.id}>
                  {`#${expanded.record.id.slice(0, 8)}…`}
                </span>
              </div>
              <button type="button" className={styles.drawerClose} aria-label={t('drawerClose')}
                onClick={() => { setExpanded(null) }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </button>
            </header>
            <div className={styles.drawerBody}>
              {expanded.kind === 'review'
                ? <ReviewBody t={t} recordId={expanded.record.id} scope={expanded.record.scope} project={projectSelector} />
                : <EditForm t={t} record={expanded.record} onClose={() => { setExpanded(null) }}
                    onSaved={() => { setExpanded(null); reload() }} toast={toast} />}
            </div>
          </aside>
        </>
      )}
      {/* Toast 叠层（右上角，position:fixed 脱离 panel 容器）。 */}
      {toast.viewport}
    </div>
  )
}

/**
 * 注册用的薄包装：把**可选取用**的宿主服务经闭包带进 props。
 * 放在 .tsx 里是因为 index.ts 不能写 JSX；服务缺席时照常渲染（chip 显示「无工作区信息」）。
 * 服务按**渲染期现取**（getter 而非实例）：宿主工作区/会话服务可能在插件 apply 之后才挂载。
 * @param services - 取宿主服务的 getter（workspaces / sessions，均可缺席）。
 * @returns 与注册席位兼容的组件（只吃 locale 的 t，其余 props 原样忽略）。
 */
export function bindEngramSection(services: {
  readonly workspaces: () => WorkspacesLike | undefined
  readonly sessions: () => SessionsLike | undefined
}): (props: PropsLocale<typeof NS>) => React.ReactElement {
  return function EngramSectionBound(props: PropsLocale<typeof NS>): React.ReactElement {
    return <EngramSection {...props} workspaces={services.workspaces()} sessions={services.sessions()} />
  }
}
