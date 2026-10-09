import {HomeWorkspaceSummary} from '@/dsh/HomeWorkspaceSummary'
import type { CSSProperties } from 'react'
import { Link } from '@tanstack/react-router'
import { AlertCircle, ArrowRight, ExternalLink, Pencil, RefreshCw } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { lazy, Suspense, useCallback, useContext, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { RestartOverlay } from '@/components/restart-overlay'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { ThinkingIllustration } from '@/components/ui/thinking-illustration'
import { RestartProvider, useRestart } from '@/lib/restart-context'
import { ThemeProviderContext } from '@/lib/theme-context'
import { openUpdateNotice } from '@/lib/update-notice-events'
import { cn } from '@/lib/utils'
import { APP_VERSION } from '@/lib/version'

import { useBotStatus } from './home/hooks/useBotStatus'
import { useDashboardData } from './home/hooks/useDashboardData'
import { useFeatureStatus, type PluginIndicator } from './home/hooks/useFeatureStatus'
import { useMaibotVersion } from './home/hooks/useMaibotVersion'
import { HitokotoEditorDialog } from './home/HitokotoEditorDialog'
import { HomeCardManager, type HomeCardDefinition } from './home/HomeCardManager'
import { usePluginHomeCards } from './home/hooks/usePluginHomeCards'
import { useQuickShortcuts } from './home/hooks/useQuickShortcuts'
import { useReviewStats } from './home/hooks/useReviewStats'
import {
  CostTrendCard,
  DailyStatisticsCard,
  ModelDetailsCard,
  ModelDistributionCard,
  PromptCacheCard,
  RequestTrendCard,
  StatisticsOverviewCard,
  TokenTrendCard,
} from './home/StatisticsCards'
import type { TimeSeriesData } from './home/types'

const ExpressionReviewer = lazy(() =>
  import('@/components/expression-reviewer').then((module) => ({
    default: module.ExpressionReviewer,
  }))
)

// 主导出组件：包装 RestartProvider
export function IndexPage() {
  return (
    <RestartProvider>
      <IndexPageContent />
    </RestartProvider>
  )
}

// 内部实现组件
type BotRuntimeState = 'loading' | 'running' | 'stopped' | 'unknown'

function BotActivityOrbit({ state }: { state: BotRuntimeState }) {
  return (
    <div
      aria-hidden="true"
      data-maibot-activity-orbit="true"
      data-state={state}
      className="relative h-[72px] w-[72px] shrink-0"
    >
      <span />
      <span />
      <span />
    </div>
  )
}

function FeatureStatusLight({label,indicator}:{label:string;indicator:PluginIndicator}) {
  return <div data-dashboard-feature-status="true" data-enabled={indicator.enabled===null?'unknown':String(indicator.enabled)} role="status" aria-label={`${label}：${indicator.text}`} title={indicator.detail} className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs font-medium">
    <span data-dashboard-feature-status-light="true" className={cn('h-2.5 w-2.5 shrink-0 rounded-none',indicator.enabled===true?'bg-primary':indicator.enabled===false?'bg-muted-foreground/25':'bg-amber-600')}/>
    <span className="shrink-0">{label}</span><span className="ml-auto truncate">{indicator.text}</span>
  </div>
}

function BotStatusFlipCard({
  botRuntimeLabel,
  botRuntimeState,
  memory,
  onlineData,
  uptime,
  subagent,
}: {
  botRuntimeLabel: string
  botRuntimeState: BotRuntimeState
  memory: PluginIndicator
  onlineData: TimeSeriesData[]
  uptime: string | null
  subagent: PluginIndicator
}) {
  const { i18n, t } = useTranslation()
  const prefersReducedMotion = useReducedMotion()
  const [isFlipped, setIsFlipped] = useState(false)
  const recentOnlineData = onlineData.slice(-24)
  const recentOnlineSeconds = recentOnlineData.reduce(
    (total, item) => total + item.online_seconds,
    0
  )
  const formatOnlineTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.round((seconds % 3600) / 60)
    return t('home.time.hoursMinutes', { hours, minutes })
  }
  const faceClassName =
    'absolute inset-0 isolate h-full overflow-visible rounded-lg [backface-visibility:hidden] [will-change:transform]'
  const cardClassName =
    'relative z-10 h-full overflow-hidden transition-[border-color,background-color,box-shadow] duration-300'

  return (
    <button
      type="button"
      data-maibot-status-flip-card="true"
      disabled
      title="本次服务运行时长；历史在线图表未接入"
      aria-label="DSH 本次服务状态"
      aria-pressed={isFlipped}
      className="group focus-visible:ring-primary/55 focus-visible:ring-offset-background relative isolate block h-full min-h-[136px] w-full overflow-visible rounded-lg text-left [perspective:900px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      onClick={() => setIsFlipped((current) => !current)}
    >
      <motion.div
        data-maibot-status-rotor="true"
        className="relative z-10 h-full min-h-[136px] w-full [transform-style:preserve-3d] [will-change:transform]"
        animate={{ rotateY: prefersReducedMotion ? 0 : isFlipped ? 180 : 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.46, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          data-maibot-status-face="front"
          aria-hidden={isFlipped}
          className={faceClassName}
          animate={{ opacity: prefersReducedMotion && isFlipped ? 0 : 1 }}
          transition={{ duration: prefersReducedMotion ? 0.12 : 0 }}
        >
          <span
            aria-hidden="true"
            data-maibot-status-glow="true"
            className="pointer-events-none absolute -inset-4 z-0 rounded-[1.5rem]"
          />
          <Card data-maibot-status-surface="true" className={cardClassName}>
            <CardContent
              data-home-titleless-content="true"
              data-maibot-status-card-content="true"
              className="p-3 sm:p-3"
            >
              <div className="space-y-2">
                <div data-maibot-runtime-status="true" className="flex items-center gap-2.5">
                  <BotActivityOrbit state={botRuntimeState} />
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                    <div
                      data-maibot-runtime-label="true"
                      className={cn(
                        'min-w-0 text-[32px] leading-none font-black tracking-[-0.05em] whitespace-nowrap',
                        botRuntimeState === 'running' && 'text-primary',
                        botRuntimeState === 'stopped' && 'text-destructive',
                        botRuntimeState !== 'running' &&
                          botRuntimeState !== 'stopped' &&
                          'text-muted-foreground'
                      )}
                    >
                      {botRuntimeLabel}
                    </div>
                    {uptime && (
                      <div
                        data-maibot-runtime-uptime="true"
                        className="text-muted-foreground shrink-0 text-left text-xs font-bold tracking-tight whitespace-nowrap tabular-nums"
                      >
                        {uptime}
                      </div>
                    )}
                  </div>
                </div>
                <div
                  data-maibot-feature-lights="true"
                  className="grid grid-cols-1 gap-2 border-t pt-2"
                >
                  <FeatureStatusLight label="子代理" indicator={subagent}/>
                  <FeatureStatusLight label="记忆插件" indicator={memory}/>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          data-maibot-status-face="back"
          aria-hidden={!isFlipped}
          className={faceClassName}
          style={{ transform: prefersReducedMotion ? 'none' : 'rotateY(180deg)' }}
          animate={{ opacity: prefersReducedMotion && !isFlipped ? 0 : 1 }}
          transition={{ duration: prefersReducedMotion ? 0.12 : 0 }}
        >
          <Card data-maibot-status-surface="true" className={cardClassName}>
            <CardContent
              data-home-titleless-content="true"
              className="flex h-full flex-col px-3 pt-2.5 pb-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-sm font-black tracking-tight">
                  {t('home.botStatus.recentOnline')}
                </div>
                <div className="text-muted-foreground text-[10px] font-semibold tracking-wide">
                  {t('home.botStatus.recentOnlineRange')}
                </div>
              </div>
              <div
                role="img"
                aria-label={t('home.botStatus.recentOnlineChart')}
                className="mt-1 min-h-0 flex-1"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={recentOnlineData}
                    margin={{ top: 5, right: 0, bottom: 0, left: 0 }}
                  >
                    <XAxis dataKey="timestamp" hide />
                    <YAxis domain={[0, 3600]} hide />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted) / 0.32)' }}
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        color: 'hsl(var(--popover-foreground))',
                        fontSize: 11,
                      }}
                      formatter={(value) => [
                        formatOnlineTime(Number(value)),
                        t('home.botStatus.online'),
                      ]}
                      labelFormatter={(value) =>
                        new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(new Date(String(value)))
                      }
                    />
                    <Bar
                      dataKey="online_seconds"
                      fill="hsl(var(--primary) / 0.68)"
                      maxBarSize={7}
                      radius={[3, 3, 1, 1]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-between gap-2 border-t pt-1.5">
                <span className="text-muted-foreground text-[10px]">
                  {t('home.botStatus.clickToReturn')}
                </span>
                <span className="text-xs font-bold tabular-nums">
                  {t('home.botStatus.recentOnlineTotal', {
                    time: '—',
                  })}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </button>
  )
}

function formatStorageBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '—';
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** unitIndex
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function compareVersions(left: string, right: string): number {
  const parseVersion = (version: string): number[] => {
    const match = version.replace(/^v/i, '').match(/^\d+(?:\.\d+)*/)
    return (match?.[0] ?? '0').split('.').map((part) => Number.parseInt(part, 10))
  }
  const leftParts = parseVersion(left)
  const rightParts = parseVersion(right)
  const length = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

function IndexPageContent() {
  const { t } = useTranslation()
  const { themeConfig } = useContext(ThemeProviderContext)
  const { triggerRestart, isRestarting } = useRestart()

  // 各数据源领域 hook（页面逻辑下沉，主文件退化为薄渲染层）
  const {
    dashboardData,
    error: dashboardError,
    loading,
    loadingProgress,
    fetchDashboardData,
  } = useDashboardData()
  const { botStatus, isBotStatusLoading, fetchBotStatus } = useBotStatus()
  const { featureStatus, fetchFeatureStatus } = useFeatureStatus()
  const { uncheckedCount, fetchReviewStats } = useReviewStats()
  const {
    hitokoto,
    hitokotoLoading,
    hitokotoSettings,
    maibotStableRelease,
    versionCompatibility,
    fetchHitokoto,
    saveHitokotoSettings,
  } = useMaibotVersion()
  const { pluginHomeCards } = usePluginHomeCards()

  const [isReviewerOpen, setIsReviewerOpen] = useState(false)
  const [hitokotoEditorOpen, setHitokotoEditorOpen] = useState(false)

  const handleRestart = useCallback(async () => {
    await triggerRestart()
  }, [triggerRestart])

  const openReviewer = useCallback(() => setIsReviewerOpen(true), [])

  const {
    quickShortcutIds,
    quickShortcutDialogOpen,
    setQuickShortcutDialogOpen,
    quickShortcutSearch,
    setQuickShortcutSearch,
    isPluginShortcutsLoading,
    selectedQuickShortcuts,
    filteredQuickShortcutOptions,
    toggleQuickShortcut,
    resetQuickShortcuts,
  } = useQuickShortcuts({
    isRestarting,
    handleRestart,
    uncheckedCount,
    onOpenReviewer: openReviewer,
  })

  // 初始加载各数据源
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- 挂载时拉取仪表盘各数据源 */
    fetchDashboardData()
    fetchHitokoto()
    fetchBotStatus(true)
    fetchFeatureStatus()
    fetchReviewStats()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [
    fetchDashboardData,
    fetchHitokoto,
    fetchBotStatus,
    fetchFeatureStatus,
    fetchReviewStats,
  ])

  if (dashboardError && !dashboardData) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="text-destructive mx-auto h-10 w-10" />
            <CardTitle>仪表盘加载失败</CardTitle>
            <CardDescription>{dashboardError}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => void fetchDashboardData(true)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              重新加载
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading || !dashboardData) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center">
        <div className="w-full max-w-md space-y-6 px-4 text-center">
          <ThinkingIllustration size="lg" className="mx-auto" />
          <div className="space-y-2">
            <Progress value={loadingProgress} className="h-2" />
            <p className="text-muted-foreground text-xs">{loadingProgress}%</p>
          </div>
        </div>
      </div>
    )
  }

  // 格式化时间显示
  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return '运行时长暂未接入';
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return t('home.time.hoursMinutes', { hours, minutes })
  }

  const botRuntimeState: BotRuntimeState =
    isBotStatusLoading && !botStatus
      ? 'loading'
      : botStatus?.running === true
        ? 'running'
        : botStatus
          ? 'stopped'
          : 'unknown'
  const botRuntimeLabel = t(`home.botStatus.${botRuntimeState}`)
  const homeCards: HomeCardDefinition[] = [
    {
      id: 'builtin:bot-status',
      title: t('home.botStatus.title'),
      width: 'small',
      category: 'status',
      source: 'builtin',
      render: () => (
        <BotStatusFlipCard
          botRuntimeLabel={botRuntimeLabel}
          botRuntimeState={botRuntimeState}
          memory={featureStatus.memory}
          onlineData={dashboardData.hourly_data}
          uptime={
            botStatus ? t('home.botStatus.uptime', { time: formatTime(botStatus.uptime) }) : null
          }
          subagent={featureStatus.subagent}
        />
      ),
    },
    {
      id: 'builtin:quick-actions',
      title: t('home.quickActions.title'),
      width: 'medium',
      category: 'status',
      editLabel: t('home.quickActions.customize'),
      onEdit: () => setQuickShortcutDialogOpen(true),
      source: 'builtin',
      render: () => (
        <Card className="h-full"><CardHeader className="flex flex-row items-center justify-between gap-2"><CardTitle className="text-base">快捷操作</CardTitle><Button size="sm" variant="ghost" onClick={()=>setQuickShortcutDialogOpen(true)}>自定义</Button></CardHeader>
          <CardContent className="relative">
            {selectedQuickShortcuts.length === 0 ? (
              <div className="text-muted-foreground flex flex-col gap-3 rounded-lg border border-dashed p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span>{t('home.quickActions.empty')}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickShortcutDialogOpen(true)}
                >
                  {t('home.quickActions.add')}
                </Button>
              </div>
            ) : (
              <div data-home-quick-actions-list="true" className="flex flex-wrap gap-2">
                {selectedQuickShortcuts.map((shortcut) => {
                  const Icon = shortcut.icon
                  const content = (
                    <>
                      <Icon
                        className={`h-4 w-4 ${shortcut.id === 'action:restart' && isRestarting ? 'animate-spin' : ''}`}
                      />
                      <span className="min-w-0 flex-1 truncate text-left">{shortcut.label}</span>
                      {shortcut.badge && (
                        <span
                          data-quick-action-badge="true"
                          className="ml-1 shrink-0 rounded-full bg-orange-500 px-1.5 py-0.5 text-xs text-white"
                        >
                          {shortcut.badge}
                        </span>
                      )}
                      {shortcut.external && <ExternalLink className="h-3.5 w-3.5 shrink-0" />}
                    </>
                  )

                  if (shortcut.href) {
                    return (
                      <Button
                        key={shortcut.id}
                        variant="outline"
                        size="sm"
                        asChild
                        className="max-w-[14rem] justify-start gap-2 overflow-hidden sm:max-w-[18rem]"
                      >
                        <a
                          href={shortcut.href}
                          target={shortcut.external ? '_blank' : undefined}
                          rel={shortcut.external ? 'noopener noreferrer' : undefined}
                          title={shortcut.label}
                        >
                          {content}
                        </a>
                      </Button>
                    )
                  }

                  return (
                    <Button
                      key={shortcut.id}
                      variant="outline"
                      size="sm"
                      onClick={shortcut.action}
                      disabled={shortcut.disabled}
                      className="max-w-[14rem] justify-start gap-2 overflow-hidden sm:max-w-[18rem]"
                      title={shortcut.label}
                    >
                      {content}
                    </Button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ),
    },
    {
      id: 'builtin:stats-overview',
      title: t('home.stats.overviewTitle'),
      description: t('home.stats.overviewDesc'),
      width: 'wide',
      allowedWidths: ['large', 'wide', 'full'],
      preferredHeight: 'low',
      category: 'statistics',
      source: 'builtin',
      render: () => <StatisticsOverviewCard />,
    },
    {
      id: 'builtin:prompt-cache',
      title: t('home.cache.title'),
      description: t('home.cache.description'),
      width: 'medium',
      allowedWidths: ['medium', 'large'],
      preferredHeight: 'low',
      category: 'statistics',
      source: 'builtin',
      render: () => <PromptCacheCard />,
    },
    {
      id: 'builtin:request-trend',
      title: t('home.charts.requestTrend'),
      description: t('home.charts.requestTrendDescCompact'),
      width: 'large',
      allowedWidths: ['large', 'wide', 'full'],
      preferredHeight: 'high',
      category: 'statistics',
      source: 'builtin',
      render: () => <RequestTrendCard />,
    },
    {
      id: 'builtin:token-trend',
      title: t('home.charts.tokenUsage'),
      description: t('home.charts.tokenUsageSplitDesc'),
      width: 'large',
      allowedWidths: ['large', 'wide', 'full'],
      preferredHeight: 'high',
      category: 'statistics',
      source: 'builtin',
      render: () => <TokenTrendCard />,
    },
    {
      id: 'builtin:cost-trend',
      title: t('home.charts.costTrend'),
      description: t('home.charts.costTrendDesc'),
      width: 'large',
      allowedWidths: ['large', 'wide', 'full'],
      preferredHeight: 'high',
      category: 'statistics',
      source: 'builtin',
      defaultHidden: true,
      render: () => <CostTrendCard />,
    },
    {
      id: 'builtin:model-distribution',
      title: t('home.charts.modelDistribution'),
      description: t('home.charts.modelDistributionCardDesc'),
      width: 'large',
      allowedWidths: ['large', 'wide'],
      preferredHeight: 'high',
      category: 'analysis',
      source: 'builtin',
      defaultHidden: true,
      render: () => <ModelDistributionCard />,
    },
    {
      id: 'builtin:model-details',
      title: t('home.charts.modelDetails'),
      description: t('home.charts.modelDetailsTokenDesc'),
      width: 'large',
      allowedWidths: ['large', 'wide', 'full'],
      preferredHeight: 'high',
      category: 'analysis',
      source: 'builtin',
      defaultHidden: true,
      render: () => <ModelDetailsCard />,
    },
    {
      id: 'builtin:daily-statistics',
      title: t('home.charts.dailyStats'),
      description: t('home.charts.dailyStatsRangeDesc'),
      width: 'full',
      allowedWidths: ['wide', 'full'],
      preferredHeight: 'high',
      category: 'analysis',
      source: 'builtin',
      defaultHidden: true,
      render: () => <DailyStatisticsCard />,
    },
    {
      id: 'builtin:storage',
      title: '工作区与扩展',
      width: 'large',
      category: 'status',
      source: 'builtin',
      render: () => <HomeWorkspaceSummary/>,
    },
    {
      id: 'builtin:hitokoto',
      title: t('home.hitokoto.title'),
      width: 'full',
      category: 'status',
      editLabel: t('home.hitokoto.edit'),
      onEdit: () => setHitokotoEditorOpen(true),
      source: 'builtin',
      variant: 'separator',
      render: () => (
        <div
          data-home-hitokoto="true"
          className={cn(
            'bg-muted/20 flex h-full w-full items-center gap-3 rounded-lg px-4',
            themeConfig.dashboardStyle !== 'future-retro' &&
              'border-muted-foreground/30 border border-dashed'
          )}
        >
          <div className="min-w-0 flex-1">
            {hitokotoLoading ? (
              <Skeleton className="h-5 w-full" />
            ) : hitokoto ? (
              <p
                className={cn(
                  'text-muted-foreground truncate',
                  themeConfig.dashboardStyle === 'future-retro'
                    ? 'text-[1.05rem] font-medium tracking-wide'
                    : 'text-sm italic'
                )}
                style={
                  themeConfig.dashboardStyle === 'future-retro'
                    ? {
                        fontFamily: '"MaiRetroQuote", "Noto Serif SC", "SimSun", serif',
                        textShadow: '0 0.035em 0 hsl(var(--background))',
                      }
                    : undefined
                }
              >
                "{hitokoto.hitokoto}"{hitokoto.from ? ` —— ${hitokoto.from}` : ''}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            data-home-hitokoto-edit="true"
            aria-label={t('home.hitokoto.edit')}
            title={t('home.hitokoto.edit')}
            className="text-muted-foreground/55 hover:bg-accent/50 hover:text-foreground focus-visible:ring-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
            onClick={() => setHitokotoEditorOpen(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ]
  const firstRowCardIds = ['builtin:bot-status', 'builtin:quick-actions', 'builtin:storage']
  const hitokotoCardId = 'builtin:hitokoto'
  const orderedHomeCards = [
    ...firstRowCardIds
      .map((id) => homeCards.find((card) => card.id === id))
      .filter((card): card is HomeCardDefinition => card !== undefined),
    ...homeCards.filter((card) => card.id === hitokotoCardId),
    ...homeCards.filter((card) => !firstRowCardIds.includes(card.id) && card.id !== hitokotoCardId),
  ]
  const maibotUpdateAvailable = Boolean(
    botStatus?.version &&
    maibotStableRelease &&
    compareVersions(maibotStableRelease.version, botStatus.version) > 0
  )
  const versionsMismatch =
    versionCompatibility?.status !== undefined && versionCompatibility.status !== 'compatible'
  return (
    <ScrollArea className="h-full">
      <div data-home-page="true" className="space-y-2 p-4 sm:space-y-4 sm:p-6">
        {dashboardError && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-destructive flex min-w-0 items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="truncate">{dashboardError}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => void fetchDashboardData(true)}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                重新加载
              </Button>
            </CardContent>
          </Card>
        )}
        <div
          data-home-command-strip="true"
          className={cn(
            'text-primary flex flex-wrap items-center gap-x-7 gap-y-2 font-sans font-black tracking-[0.12em] uppercase',
            versionsMismatch && 'text-amber-600 dark:text-amber-400'
          )}
        >
          <button
            type="button"
            data-home-version-button="true"
            className="inline-flex items-baseline gap-2"
            title="版本信息；更新操作暂未接入" disabled
          >
            <span className="text-[11px] tracking-[0.2em] opacity-70">
              {t('home.versionCard.maibotVersion')}
            </span>
            <span className="text-base">
              {botStatus?.version ? `V${botStatus.version}` : t('home.versionCard.unknown')}
            </span>
          </button>
          <button
            type="button"
            data-home-version-button="true"
            className="inline-flex items-baseline gap-2"
            title="版本信息；更新操作暂未接入" disabled
          >
            <span className="text-[11px] tracking-[0.2em] opacity-70">
              {t('home.versionCard.consoleVersion')}
            </span>
            <span className="text-base">V{APP_VERSION}</span>
          </button>
          {maibotUpdateAvailable && maibotStableRelease && (
            <a
              href={maibotStableRelease.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-sky-600 hover:underline dark:text-sky-400"
            >
              {t('home.versionCard.updateAvailable')} V{maibotStableRelease.version}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {versionsMismatch && <span className="text-sm">{t('home.versionCard.mismatch')}</span>}
          <span
            aria-hidden="true"
            data-home-version-stripes="true"
            className="ml-auto hidden min-w-24 flex-1 basis-40"
          >
            <svg
              data-home-version-spectrum="true"
              viewBox="0 0 1100 180"
              preserveAspectRatio="none"
            >
              <path data-spectrum-line="green" d="M0 84 H740 C850 84 880 18 1010 18 H1100" />
              <path data-spectrum-line="gold" d="M0 90 H1100" />
              <path data-spectrum-line="orange" d="M0 96 H740 C850 96 880 162 1010 162 H1100" />
            </svg>
          </span>
        </div>

        <HomeCardManager
          cards={orderedHomeCards}
          pluginCards={pluginHomeCards}
          controlsPortalId="home-card-controls-bottom"
        />

        <div id="home-card-controls-bottom" className="flex justify-end pt-2" />

        <Dialog open={quickShortcutDialogOpen} onOpenChange={setQuickShortcutDialogOpen}>
          <DialogContent style={{ '--dialog-width': '46rem' } as CSSProperties}>
            <DialogHeader>
              <DialogTitle>{t('home.quickActions.dialog.title')}</DialogTitle>
              <DialogDescription>{t('home.quickActions.dialog.description')}</DialogDescription>
            </DialogHeader>
            <DialogBody viewportClassName="max-h-[60vh]">
              <div className="space-y-4 pr-1">
                <Input
                  value={quickShortcutSearch}
                  onChange={(event) => setQuickShortcutSearch(event.target.value)}
                  placeholder={t('home.quickActions.dialog.searchPlaceholder')}
                />
                <div className="space-y-2">
                  {filteredQuickShortcutOptions.map((shortcut) => {
                    const Icon = shortcut.icon
                    const checked = quickShortcutIds.includes(shortcut.id)
                    const checkboxId = `quick-shortcut-${shortcut.id}`
                    return (
                      <label
                        key={shortcut.id}
                        htmlFor={checkboxId}
                        className="hover:bg-accent/40 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors"
                      >
                        <Checkbox
                          id={checkboxId}
                          className="mt-0.5"
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggleQuickShortcut(shortcut.id, value === true)
                          }
                        />
                        <Icon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{shortcut.label}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {t(`home.quickActions.categories.${shortcut.category}`)}
                            </Badge>
                          </span>
                          <span className="text-muted-foreground mt-1 block text-sm">
                            {shortcut.description}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                  {filteredQuickShortcutOptions.length === 0 && (
                    <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                      {isPluginShortcutsLoading
                        ? t('home.quickActions.dialog.loadingPluginEntries')
                        : t('home.quickActions.dialog.noMatches')}
                    </div>
                  )}
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={resetQuickShortcuts}>
                {t('home.quickActions.dialog.restoreDefault')}
              </Button>
              <Button onClick={() => setQuickShortcutDialogOpen(false)}>
                {t('home.quickActions.dialog.done')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {hitokotoEditorOpen && (
          <HitokotoEditorDialog
            initialSettings={hitokotoSettings}
            onOpenChange={setHitokotoEditorOpen}
            onSave={saveHitokotoSettings}
          />
        )}

        {/* 重启遮罩层 */}
        <RestartOverlay />

        {/* 表达方式审核器 */}
        {isReviewerOpen && (
          <Suspense fallback={null}>
            <ExpressionReviewer
              open
              onOpenChange={(open) => {
                setIsReviewerOpen(open)
                if (!open) {
                  // 关闭审核器时刷新统计
                  fetchReviewStats()
                }
              }}
            />
          </Suspense>
        )}
      </div>
    </ScrollArea>
  )
}
