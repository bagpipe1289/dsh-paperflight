import { ThinkingIllustration } from '@/components/ui/thinking-illustration'

export function RoutePendingFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <ThinkingIllustration size="lg" />
    </div>
  )
}
