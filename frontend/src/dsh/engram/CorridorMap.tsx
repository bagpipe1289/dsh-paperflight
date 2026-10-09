/**
 * 走廊鸟瞰图：中度版力导向 + 拖拽 + hover 邻居高亮 + 响应式 viewBox。
 *
 * 设计要点：
 * 1. 冷却调度 alpha 1.0 → 0.1（240 tick），保证收敛不抖。
 * 2. drag 节点：mousedown 抓住 → mousemove 改写 vx/vy 为 0（吸附鼠标）→ mouseup 释放。
 * 3. hover 节点：该节点 + 一跳邻居 + 关联边高亮，其他 0.15 透明。
 * 4. tooltip 显示完整铭牌（沿用 SVG <title> 标签 + 自定义 <foreignObject> HTML tooltip 增强可读性）。
 * 5. viewBox 自适应容器宽度（preserveAspectRatio="xMidYMid meet"），固定 560x320 逻辑坐标。
 *
 * @module @kenz1117/dsh-engram/client/CorridorMap
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import styles from './panel.module.css'
import { KIND_KEY, type EngramKey } from './locales.ts'

/** 走廊图使用的翻译函数（渲染器合成的窄签名）。 */
type CorridorT = (key: EngramKey, params?: Record<string, unknown>) => string

/** kind → 本地化房间名（词典缺失时回退数据值）。 */
function roomLabel(t: CorridorT, kind: string): string {
  const key = KIND_KEY[kind]
  return key === undefined ? kind : t(key as EngramKey)
}

interface CorridorNode {
  readonly id: string
  readonly scope: string
  readonly kind: string
  readonly status: string
  readonly importance: number
  readonly confidence: number
  readonly title: string
  /** 后端可选字段：完整铭牌（用于 tooltip）。 */
  readonly content?: string
}
interface CorridorEdge {
  readonly id: string
  readonly from: string
  readonly to: string
  readonly type: string
}

/** 房间色板：5 个语义色相（按 kind 分组）。 */
const KIND_PALETTE: Readonly<Record<string, string>> = {
  fact: '#5b8def',
  preference: '#f0a85c',
  decision: '#9b6bd9',
  episode: '#3cb489',
  skill: '#e26b86',
}

/** 边视觉语义。dash 显式允许 undefined：exactOptionalPropertyTypes 下字面量表无需逐项删键。 */
type EdgeStyle = { color: string; dash?: string | undefined; width: number }
const EDGE_STYLE: Readonly<Record<string, EdgeStyle>> = {
  related:   { color: 'rgba(120, 130, 150, 0.6)',  dash: undefined, width: 1 },
  refines:   { color: 'rgba(120, 130, 150, 0.6)',  dash: undefined, width: 1 },
  supports:  { color: 'rgba(120, 130, 150, 0.6)',  dash: undefined, width: 1 },
  supersedes:{ color: 'rgba(91, 141, 239, 0.85)', dash: undefined, width: 1.8 },
  contradicts:{ color: 'rgba(226, 107, 134, 0.9)', dash: '4 4',     width: 1.4 },
}

interface PositionedNode extends CorridorNode {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  /** 是否被用户拖拽中（拖拽时禁用 tick 力更新）。 */
  fixed: boolean
}

interface CorridorMapProps {
  readonly scope: 'user' | 'project' | 'shared'
  readonly nodes: readonly CorridorNode[]
  readonly edges: readonly CorridorEdge[]
  readonly onSelect?: (id: string) => void
  readonly selectedId?: string
  /** 界面文案（房间名与图例走宿主 locale 词典）。 */
  readonly t: CorridorT
}

/** 节点半径。 */
function nodeRadius(n: CorridorNode): number {
  return Math.max(4, Math.min(14, 4 + 10 * n.importance * n.confidence))
}

/** 单步力更新（带冷却 alpha）。 */
function step(nodes: PositionedNode[], edges: readonly CorridorEdge[], width: number, height: number, alpha: number): void {
  const REPLUSION = 4800
  const SPRING_LEN = 64
  const SPRING_K = 0.04
  const CENTER_K = 0.003
  const FLOOR_K = 0.005
  // 排斥力：平方反比（带 alpha 冷却）。
  for (let i = 0; i < nodes.length; i += 1) {
    const a = nodes[i]!
    for (let j = i + 1; j < nodes.length; j += 1) {
      const b = nodes[j]!
      const dx = a.x - b.x
      const dy = a.y - b.y
      const dist = Math.sqrt(dx * dx + dy * dy) + 0.01
      const force = (REPLUSION * alpha) / (dist * dist)
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      a.vx += fx
      a.vy += fy
      b.vx -= fx
      b.vy -= fy
    }
  }
  // 弹簧力。
  const nodeMap = new Map<string, PositionedNode>(nodes.map(n => [n.id, n]))
  for (const edge of edges) {
    const a = nodeMap.get(edge.from)
    const b = nodeMap.get(edge.to)
    if (a === undefined || b === undefined) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.sqrt(dx * dx + dy * dy) + 0.01
    const force = (dist - SPRING_LEN) * SPRING_K * alpha
    const fx = (dx / dist) * force
    const fy = (dy / dist) * force
    a.vx += fx
    a.vy += fy
    b.vx -= fx
    b.vy -= fy
  }
  // 中心引力 + 房间水平分簇。
  const kinds = [...new Set(nodes.map(n => n.kind))]
  const band = width / Math.max(kinds.length, 1)
  for (const n of nodes) {
    if (n.fixed) continue
    n.vx += (width / 2 - n.x) * CENTER_K * alpha
    n.vy += (height / 2 - n.y) * CENTER_K * alpha
    const idx = kinds.indexOf(n.kind)
    if (idx >= 0) {
      const target = band * (idx + 0.5)
      n.vx += (target - n.x) * FLOOR_K * alpha
    }
  }
  // 阻尼 + 边界。
  const DAMPING = 0.82
  for (const n of nodes) {
    if (n.fixed) { n.vx = 0; n.vy = 0; continue }
    n.vx *= DAMPING
    n.vy *= DAMPING
    n.x = Math.max(20, Math.min(width - 20, n.x + n.vx))
    n.y = Math.max(20, Math.min(height - 20, n.y + n.vy))
  }
}

/** 走廊鸟瞰组件。 */
export function CorridorMap(props: CorridorMapProps): ReactElement {
  const { scope, nodes, edges, onSelect, selectedId, t } = props
  const width = 560
  const height = 320
  /** 邻居表：node id → 邻居 id 集合（含一跳）。 */
  const neighborMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const n of nodes) map.set(n.id, new Set())
    for (const e of edges) {
      if (!map.has(e.from)) map.set(e.from, new Set())
      if (!map.has(e.to)) map.set(e.to, new Set())
      map.get(e.from)!.add(e.to)
      map.get(e.to)!.add(e.from)
    }
    return map
  }, [nodes, edges])
  /** 起始布局：按房间水平均分带，垂直随机抖动。 */
  const initialNodes = useMemo<PositionedNode[]>(() => {
    const kinds = [...new Set(nodes.map(n => n.kind))]
    const band = width / Math.max(kinds.length, 1)
    return nodes.map((n, index) => ({
      ...n,
      x: kinds.indexOf(n.kind) >= 0 ? band * (kinds.indexOf(n.kind) + 0.5) : width / 2,
      y: 30 + ((index * 47) % (height - 60)),
      vx: 0, vy: 0,
      r: nodeRadius(n),
      fixed: false,
    }))
  }, [nodes, width, height])
  const positionsRef = useRef<PositionedNode[]>(initialNodes.map(n => ({ ...n })))
  const [, forceRender] = useState(0)
  const animRef = useRef<number | null>(null)
  const tickRef = useRef(0)
  const totalTicks = 280
  // 初始化 / 重置：拷贝新布局并清零 tick。
  useEffect(() => {
    positionsRef.current = initialNodes.map(n => ({ ...n }))
    tickRef.current = 0
    forceRender(value => value + 1)
  }, [initialNodes])
  // 力导向主循环：requestAnimationFrame，alpha 1.0 → 0.1。
  useEffect(() => {
    const tick = (): void => {
      const nodesArr = positionsRef.current
      tickRef.current += 1
      const alpha = Math.max(0.1, 1 - (tickRef.current / totalTicks) * 0.9)
      step(nodesArr, edges, width, height, alpha)
      // 触发 React 重渲染（不可变快照：拷贝一次引用）。
      positionsRef.current = nodesArr.map(n => ({ ...n }))
      forceRender(value => value + 1)
      if (tickRef.current < totalTicks) animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => { if (animRef.current !== null) cancelAnimationFrame(animRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tick 仅在新 nodes/edges 时重启
  }, [initialNodes, edges])
  const positions = positionsRef.current
  const posMap = useMemo(() => new Map(positions.map(p => [p.id, p])), [positions])
  const roomKinds = useMemo(() => [...new Set(nodes.map(n => n.kind))], [nodes])
  /** hover 高亮：当前节点 id → 邻居 id 集合；null = 不高亮。 */
  const [hoverId, setHoverId] = useState<string | null>(null)
  const hoverNeighbors = useMemo(() => {
    if (hoverId === null) return null
    return neighborMap.get(hoverId) ?? new Set<string>()
  }, [hoverId, neighborMap])
  const isFaded = (nId: string): boolean => hoverId !== null && nId !== hoverId && !(hoverNeighbors?.has(nId) ?? false)
  const isEdgeHighlighted = (e: CorridorEdge): boolean => {
    if (hoverId === null) return false
    return e.from === hoverId || e.to === hoverId
  }
  /** drag：mousedown 抓住节点 → mousemove 改 vx/vy 为 0 → mouseup 释放。 */
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragIdRef = useRef<string | null>(null)
  const svgToScreen = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = svgRef.current
    if (svg === null) return null
    const rect = svg.getBoundingClientRect()
    // viewBox 0 0 width height，preserveAspectRatio meet → 等比缩放，逻辑坐标 = 屏幕坐标 * (width / rect.width)
    const scaleX = width / rect.width
    const scaleY = height / rect.height
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
  }
  const onNodeMouseDown = (event: React.MouseEvent<SVGGElement>, nodeId: string): void => {
    event.preventDefault()
    dragIdRef.current = nodeId
    const node = positionsRef.current.find(n => n.id === nodeId)
    if (node !== undefined) node.fixed = true
  }
  useEffect(() => {
    const handleMove = (event: MouseEvent): void => {
      const id = dragIdRef.current
      if (id === null) return
      const pos = svgToScreen(event.clientX, event.clientY)
      if (pos === null) return
      const node = positionsRef.current.find(n => n.id === id)
      if (node === undefined) return
      node.x = Math.max(20, Math.min(width - 20, pos.x))
      node.y = Math.max(20, Math.min(height - 20, pos.y))
      node.vx = 0
      node.vy = 0
      forceRender(value => value + 1)
    }
    const handleUp = (): void => {
      const id = dragIdRef.current
      if (id === null) return
      const node = positionsRef.current.find(n => n.id === id)
      if (node !== undefined) node.fixed = false
      dragIdRef.current = null
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (nodes.length === 0) {
    return <div className={styles.empty}>{t('corridorEmpty')}</div>
  }

  return (
    <div className={styles.mapWrap}>
      <svg ref={svgRef} viewBox={`0 0 ${String(width)} ${String(height)}`} className={styles.map}
        preserveAspectRatio="xMidYMid meet" role="img" aria-label={t('corridorAria')} key={scope}>
        {/* 房间背景带（斑马纹区隔）。scope 切换通过父 svg key 重挂载触发 fade-in。 */}
        {roomKinds.map((kind, idx) => {
          const band = width / Math.max(roomKinds.length, 1)
          return <rect key={kind} x={band * idx} y={0} width={band} height={height} fill={idx % 2 === 0 ? 'rgba(127,127,127,0.04)' : 'transparent'} />
        })}
        {/* 房间标签条顶部。 */}
        {roomKinds.map((kind, idx) => {
          const band = width / Math.max(roomKinds.length, 1)
          return (
            <text key={`${kind}-label`} x={band * (idx + 0.5)} y={14} textAnchor="middle"
              fill="rgba(127,127,127,0.7)" fontSize="10" fontFamily="ui-sans-serif, system-ui">
              {roomLabel(t, kind)}
            </text>
          )
        })}
        {/* 走廊边：高亮时画弹簧弧线（quadratic 曲线 + 垂直凸起 6px），其他边保持直线。
            用 stagger-delay 让边按 from 节点索引依次淡入，强化「地图刷新」感。 */}
        {edges.map((edge, idx) => {
          const a = posMap.get(edge.from)
          const b = posMap.get(edge.to)
          if (a === undefined || b === undefined) return null
          const style = EDGE_STYLE[edge.type] ?? EDGE_STYLE.related!
          const highlighted = isEdgeHighlighted(edge)
          const faded = hoverId !== null && !highlighted
          if (highlighted) {
            // 垂直中点偏移：构造弹簧视觉。
            const mx = (a.x + b.x) / 2
            const my = (a.y + b.y) / 2
            const dx = b.x - a.x
            const dy = b.y - a.y
            const length = Math.sqrt(dx * dx + dy * dy) || 1
            const offsetX = (-dy / length) * 6
            const offsetY = (dx / length) * 6
            return (
              <path key={edge.id} d={`M ${String(a.x)} ${String(a.y)} Q ${String(mx + offsetX)} ${String(my + offsetY)} ${String(b.x)} ${String(b.y)}`}
                fill="none" stroke={style.color}
                strokeWidth={style.width + 1.2} strokeDasharray={style.dash}
                style={{ transition: 'stroke-width 200ms ease, d 240ms ease' }}>
                <title>{`${a.title} --${edge.type}--> ${b.title}`}</title>
              </path>
            )
          }
          return (
            <line key={edge.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={style.color} strokeWidth={style.width}
              strokeDasharray={style.dash} opacity={faded ? 0.1 : 1}
              className={styles.edgeFade}
              style={{ transition: 'opacity 200ms ease, stroke-width 200ms ease', animationDelay: `${String(Math.min(idx, 24) * 24)}ms` }}>
              <title>{`${a.title} --${edge.type}--> ${b.title}`}</title>
            </line>
          )
        })}
        {/* 房间节点。 */}
        {positions.map((n, index) => {
          const color = KIND_PALETTE[n.kind] ?? '#7d8590'
          const isSelected = selectedId === n.id
          const isHovered = hoverId === n.id
          const faded = isFaded(n.id)
          return (
            <g key={n.id} className={styles.node} transform={`translate(${String(n.x)} ${String(n.y)})`}
              style={{ cursor: dragIdRef.current === n.id ? 'grabbing' : 'grab', opacity: faded ? 0.15 : 1, transition: 'opacity 200ms ease', animationDelay: `${String(Math.min(index, 24) * 24)}ms` }}
              onMouseEnter={() => { setHoverId(n.id) }}
              onMouseLeave={() => { setHoverId(prev => prev === n.id ? null : prev) }}
              onMouseDown={event => onNodeMouseDown(event, n.id)}
              onClick={() => onSelect?.(n.id)}>
              {/* hover 时画一圈柔光外晕。 */}
              {(isHovered || isSelected) && (
                <circle r={String(n.r + 6)} fill={color} fillOpacity={0.18} />
              )}
              <circle r={String(n.r)} fill={color} fillOpacity={n.status === 'active' ? 0.88 : 0.42}
                stroke={isSelected ? 'var(--dsw-alias-brand-primary)' : isHovered ? color : 'rgba(255,255,255,0.9)'}
                strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 1}
                style={{ transition: 'stroke 160ms ease, stroke-width 160ms ease' }}>
                <title>{`${n.title}（${n.kind}/${n.status}）`}</title>
              </circle>
              {isSelected && <circle r={String(n.r + 4)} fill="none" stroke={color} strokeOpacity={0.4} strokeWidth={1} />}
            </g>
          )
        })}
        {/* hover tooltip：HTML 浮层，显示完整铭牌（用 SVG <text> 简易渲染）。 */}
        {hoverId !== null && (() => {
          const node = posMap.get(hoverId)
          if (node === undefined) return null
          const tx = Math.min(width - 180, Math.max(8, node.x + 14))
          const ty = Math.min(height - 60, Math.max(28, node.y - 16))
          const fullContent = (node.content ?? node.title).slice(0, 120)
          return (
            <g className={styles.tooltip} transform={`translate(${String(tx)} ${String(ty)})`}>
              <rect x={0} y={0} width={176} height={48} rx={6} ry={6}
                fill="var(--dsw-alias-bg-base)" stroke="var(--dsw-alias-border-l2)" strokeWidth={1} opacity={0.96} />
              <text x={8} y={16} fill="var(--dsw-alias-label-primary)" fontSize="11" fontWeight={600}
                fontFamily="ui-sans-serif, system-ui">{roomLabel(t, node.kind)}</text>
              <text x={8} y={32} fill="var(--dsw-alias-label-secondary)" fontSize="10"
                fontFamily="ui-sans-serif, system-ui">{`${fullContent}${(node.content ?? node.title).length > 120 ? '…' : ''}`}</text>
            </g>
          )
        })()}
      </svg>
      <div className={styles.legend}>
        {roomKinds.map(kind => (
          <span key={kind} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: KIND_PALETTE[kind] ?? '#7d8590' }} />
            {roomLabel(t, kind)}
          </span>
        ))}
        <span className={styles.legendItem}>{t('corridorSummary', { nodes: nodes.length, edges: edges.length })}</span>
      </div>
      <div className={styles.legend} style={{ marginTop: 2 }}>
        {Object.entries(EDGE_STYLE).map(([type, style]) => (
          <span key={type} className={styles.legendItem}>
            <svg width={20} height={6} aria-hidden="true">
              <line x1={0} y1={3} x2={20} y2={3} stroke={style.color} strokeWidth={style.width} strokeDasharray={style.dash} />
            </svg>
            <span>{type === 'supersedes' ? t('edgeSupersedes') : type === 'contradicts' ? t('edgeContradicts') : t('edgeOther')}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
