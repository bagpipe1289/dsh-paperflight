import { cn } from '@/lib/utils'

/** Shared header/dock handle. The side handle uses the same line, turned vertically. */
export function CollapseHandle({ label, expanded, onClick, orientation = 'horizontal', className, controls }: {
  label: string
  expanded: boolean
  onClick?: () => void
  orientation?: 'horizontal' | 'vertical'
  className?: string
  controls?: string
}) {
  return <button type="button" data-dashboard-topbar-toggle="true"
    data-orientation={orientation} onClick={onClick}
    aria-label={label} aria-expanded={expanded} aria-controls={controls} title={label}
    className={cn('bg-foreground/70 relative flex shrink-0 items-center justify-center transition-shadow',
      orientation === 'horizontal' ? 'h-3 w-24' : 'h-24 w-3', className)}>
    <span className="dashboard-collapse-line" aria-hidden="true" />
    <span className="sr-only">{label}</span>
  </button>
}
