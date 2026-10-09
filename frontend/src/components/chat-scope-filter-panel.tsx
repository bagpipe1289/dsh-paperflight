import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

import { StreamlineIcon } from '@/components/ui/streamline-icon'
import { cn } from '@/lib/utils'

export interface ChatScopeMode<T extends string> {
  label: string
  value: T
}

export interface ChatScopeItem {
  id: string | number
  label: ReactNode
  title?: string
  description?: ReactNode
  descriptionTitle?: string
}

interface ChatScopeFilterPanelProps<TMode extends string> {
  modes?: ChatScopeMode<TMode>[]
  activeMode?: TMode
  onModeChange?: (mode: TMode) => void
  items: ChatScopeItem[]
  selectedItemId?: string | number | null
  onItemSelect?: (id: string | number) => void
  title?: string
  emptyContent?: ReactNode
  footer?: ReactNode
  modeColumns?: number
  collapsed?: boolean
  collapseLabel?: string
  expandLabel?: string
  onCollapsedChange?: (collapsed: boolean) => void
  className?: string
  listClassName?: string
}

export function ChatScopeFilterPanel<TMode extends string>({
  modes,
  activeMode,
  onModeChange,
  items,
  selectedItemId,
  onItemSelect,
  title,
  emptyContent,
  footer,
  modeColumns,
  collapsed = false,
  collapseLabel = '折叠列表',
  expandLabel = '展开列表',
  onCollapsedChange,
  className,
  listClassName,
}: ChatScopeFilterPanelProps<TMode>) {
  const modeItems = modes ?? []
  const hasModes = modeItems.length > 0

  return (
    <aside
      data-chat-scope-panel="true"
      data-collapsed={collapsed ? 'true' : 'false'}
      className={cn(
        'bg-card flex min-h-0 flex-col border-2 lg:h-full lg:self-stretch lg:overflow-hidden',
        className
      )}
    >
      <div data-chat-scope-panel-header="true" className="border-b-2 px-3 py-2">
        <div
          className={cn(
            'grid w-full items-center gap-2',
            onCollapsedChange ? 'grid-cols-[2rem_minmax(0,1fr)]' : 'grid-cols-1'
          )}
        >
          {onCollapsedChange && (
            <button
              type="button"
              onClick={() => onCollapsedChange(!collapsed)}
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 w-7 items-center justify-center border-2 transition-colors"
              aria-label={collapsed ? expandLabel : collapseLabel}
              aria-expanded={!collapsed}
              title={collapsed ? expandLabel : collapseLabel}
            >
              <StreamlineIcon
                name="line-arrow-right-1-remix"
                fallback={ChevronRight}
                className={cn('h-4 w-4', !collapsed && 'rotate-180')}
              />
            </button>
          )}
          {!collapsed && (
            <div className="min-w-0 space-y-2">
              {title && <h2 className="text-sm font-medium">{title}</h2>}
              {hasModes && (
                <div
                  data-chat-scope-panel-modes="true"
                  className="bg-muted grid gap-0.5 border-2 p-1"
                  style={{
                    gridTemplateColumns: `repeat(${modeColumns ?? modeItems.length}, minmax(0, 1fr))`,
                  }}
                >
                  {modeItems.map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => onModeChange?.(mode.value)}
                      data-chat-scope-panel-mode="true"
                      data-active={activeMode === mode.value ? 'true' : 'false'}
                      className={cn(
                        'min-w-0 px-1.5 py-1 text-xs transition-colors',
                        activeMode === mode.value
                          ? 'bg-background text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <span className="block truncate">{mode.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          <div
            data-chat-scope-panel-list="true"
            className={cn('min-h-0 flex-1 space-y-1 overflow-y-auto p-2', listClassName)}
          >
            {items.length > 0
              ? items.map((item) => {
                  const active = selectedItemId === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onItemSelect?.(item.id)}
                      data-chat-scope-panel-item="true"
                      data-active={active ? 'true' : 'false'}
                      className={cn(
                        'w-full px-2 py-2 text-left text-sm transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-foreground hover:bg-muted'
                      )}
                      title={item.title}
                    >
                      <span className="block truncate">{item.label}</span>
                      {item.description && (
                        <span
                          className={cn(
                            'block truncate text-xs',
                            active ? 'text-primary-foreground/75' : 'text-muted-foreground'
                          )}
                          title={item.descriptionTitle}
                        >
                          {item.description}
                        </span>
                      )}
                    </button>
                  )
                })
              : emptyContent}
          </div>
          {footer && (
            <div data-chat-scope-panel-footer="true" className="border-t-2 px-3 py-2">
              {footer}
            </div>
          )}
        </>
      )}
    </aside>
  )
}
