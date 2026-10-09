import {useMemo} from 'react'
import {useTranslation} from 'react-i18next'
import {Monitor,Moon,RotateCcw,Sun} from 'lucide-react'
import {useAnimation} from '@/hooks/use-animation'
import {useTheme} from '@/components/use-theme'
import {cn} from '@/lib/utils'
import {buildFutureRetroTexture} from '@/lib/theme/future-retro'
import {Button} from '@/components/ui/button'
import {Label} from '@/components/ui/label'
import {Switch} from '@/components/ui/switch'
import {Slider} from '@/components/ui/slider'
import {getComputedTokens} from '@/lib/theme/pipeline'
import {DEFAULT_FUTURE_RETRO_STYLE_CONFIG} from '@/lib/theme/tokens'
import type {FutureRetroStyleConfig,FutureRetroTextureStyle,ThemeTokens,TypographyTokens} from '@/lib/theme/tokens'
type ThemeMode='light'|'dark'|'system'
const themeModeOptions: Array<{
  value: ThemeMode
  labelKey: string
  descriptionKey: string
  icon: typeof Monitor
}> = [
  {
    value: 'light',
    labelKey: 'settings.appearance.light',
    descriptionKey: 'settings.appearance.lightDesc',
    icon: Sun,
  },
  {
    value: 'dark',
    labelKey: 'settings.appearance.dark',
    descriptionKey: 'settings.appearance.darkDesc',
    icon: Moon,
  },
  {
    value: 'system',
    labelKey: 'settings.appearance.system',
    descriptionKey: 'settings.appearance.systemDesc',
    icon: Monitor,
  },
]

const futureRetroTextureOptions: Array<{
  value: FutureRetroTextureStyle
  labelKey: string
}> = [
  { value: 'fine', labelKey: 'settings.appearance.retroTextureFine' },
  { value: 'coarse', labelKey: 'settings.appearance.retroTextureCoarse' },
  { value: 'dot-grid', labelKey: 'settings.appearance.retroTextureDots' },
  { value: 'ruled', labelKey: 'settings.appearance.retroTextureRuled' },
  { value: 'none', labelKey: 'settings.appearance.retroTextureNone' },
]


function buildFontSizeTokens(
  basePx: number
): Pick<
  TypographyTokens,
  | 'font-size-xs'
  | 'font-size-sm'
  | 'font-size-base'
  | 'font-size-lg'
  | 'font-size-xl'
  | 'font-size-2xl'
> {
  const toRem = (px: number) => `${Number((px / 16).toFixed(4))}rem`

  return {
    'font-size-xs': toRem(basePx * 0.75),
    'font-size-sm': toRem(basePx * 0.875),
    'font-size-base': toRem(basePx),
    'font-size-lg': toRem(basePx * 1.125),
    'font-size-xl': toRem(basePx * 1.25),
    'font-size-2xl': toRem(basePx * 1.5),
  }
}

export function AppearanceTab(){
 const {theme,setTheme,themeConfig,updateThemeConfig,resolvedTheme}=useTheme()
 const {enableAnimations,setEnableAnimations}=useAnimation()
 const {t}=useTranslation()
 const futureRetroConfig={...DEFAULT_FUTURE_RETRO_STYLE_CONFIG,...themeConfig.styleConfig?.futureRetro}
 const activeTokenOverrides=themeConfig.styleTokenOverrides?.['future-retro']??{}
 const computedTokens=useMemo(()=>getComputedTokens(themeConfig,resolvedTheme==='dark'),[themeConfig,resolvedTheme])
 const baseFontSizePx=parseFloat(computedTokens.typography['font-size-base'])*16
 function updateFutureRetroConfig(partial:Partial<FutureRetroStyleConfig>){
  updateThemeConfig({styleConfig:{futureRetro:{...futureRetroConfig,...partial}}})
 }
 function updateTokenSection<K extends keyof ThemeTokens>(section:K,partial:Partial<ThemeTokens[K]>){
  updateThemeConfig({styleTokenOverrides:{'future-retro':{...activeTokenOverrides,[section]:{...activeTokenOverrides[section],...partial}}}})
 }
 function resetRetro(){
  const next={...activeTokenOverrides};delete next.typography
  updateThemeConfig({styleTokenOverrides:{'future-retro':next},styleConfig:{futureRetro:{...DEFAULT_FUTURE_RETRO_STYLE_CONFIG}}})
 }
 return <div className="space-y-6 sm:space-y-8">
      {/* 主题模式 */}
      <div>
        <h3 className="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">
          {t('settings.appearance.themeMode')}
        </h3>
        <div
          role="tablist"
          aria-label={t('settings.appearance.themeMode')}
          className="bg-muted/60 text-muted-foreground grid w-full max-w-2xl grid-cols-1 gap-1 rounded-lg border p-1 sm:grid-cols-3"
        >
          {themeModeOptions.map((option) => {
            const selected = theme === option.value
            const Icon = option.icon

            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTheme(option.value)}
                className={cn(
                  'group flex min-h-16 flex-col justify-center rounded-md px-3 py-2 text-left transition-all',
                  'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                  selected
                    ? 'bg-background text-foreground shadow-sm'
                    : 'hover:bg-background/60 hover:text-foreground'
                )}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Icon
                    className={cn(
                      'h-4 w-4 transition-colors',
                      selected
                        ? 'text-primary'
                        : 'text-muted-foreground group-hover:text-foreground'
                    )}
                    strokeWidth={2}
                  />
                  <span>{t(option.labelKey)}</span>
                </span>
                <span className="text-muted-foreground mt-1 block max-w-full truncate text-xs">
                  {t(option.descriptionKey)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
            <div>
              <h3 className="text-base font-semibold sm:text-lg">
                {t('settings.appearance.retroConfig')}
              </h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {t('settings.appearance.retroConfigDesc')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetRetro()
              }}
              className="h-8"
            >
              <RotateCcw className="mr-2 h-3.5 w-3.5" />
              {t('settings.appearance.resetDefault')}
            </Button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="bg-card rounded-lg border p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between">
                <Label>{t('settings.appearance.baseFontSize')}</Label>
                <span className="text-muted-foreground text-sm">{baseFontSizePx}px</span>
              </div>
              <Slider
                aria-label={t('settings.appearance.baseFontSize')}
                value={[baseFontSizePx]}
                min={12}
                max={20}
                step={1}
                onValueChange={(vals) => {
                  updateTokenSection('typography', {
                    ...buildFontSizeTokens(vals[0]),
                  })
                }}
              />
            </div>

            <div className="bg-card rounded-lg border p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <Label>{t('settings.appearance.retroPaperWarmth')}</Label>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {t('settings.appearance.retroPaperWarmthDesc')}
                  </p>
                </div>
                <span className="text-muted-foreground text-sm">
                  {futureRetroConfig.paperWarmth}%
                </span>
              </div>
              <Slider
                aria-label={t('settings.appearance.retroPaperWarmth')}
                value={[futureRetroConfig.paperWarmth]}
                min={0}
                max={100}
                step={1}
                onValueChange={([paperWarmth]) => updateFutureRetroConfig({ paperWarmth })}
              />
              <div className="text-muted-foreground mt-2 flex justify-between text-[11px]">
                <span>{t('settings.appearance.retroPaperWhite')}</span>
                <span>{t('settings.appearance.retroPaperWarm')}</span>
              </div>
            </div>
          </div>

          <div className="bg-card mt-3 rounded-lg border p-3 sm:p-4">
            <div>
              <Label>{t('settings.appearance.retroTexture')}</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t('settings.appearance.retroTextureDesc')}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {futureRetroTextureOptions.map((option) => {
                const selected = futureRetroConfig.textureStyle === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    data-retro-texture-option="true"
                    data-selected={selected ? 'true' : 'false'}
                    className={cn(
                      'overflow-hidden rounded-md border text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                      selected
                        ? 'border-primary ring-primary/25 ring-2'
                        : 'border-border hover:border-primary/50'
                    )}
                    onClick={() => updateFutureRetroConfig({ textureStyle: option.value })}
                  >
                    <span
                      aria-hidden
                      className="block h-12 border-b"
                      style={{
                        backgroundColor: resolvedTheme === 'dark' ? '#110906' : '#f3e3cc',
                        backgroundImage:
                          option.value === 'none'
                            ? 'none'
                            : buildFutureRetroTexture(
                                option.value,
                                futureRetroConfig.textureIntensity,
                                resolvedTheme === 'dark'
                              ),
                      }}
                    />
                    <span className="block px-2 py-1.5 text-xs font-medium">
                      {t(option.labelKey)}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-4">
              <div className="mb-3 flex items-center justify-between">
                <Label>{t('settings.appearance.retroTextureIntensity')}</Label>
                <span className="text-muted-foreground text-sm">
                  {futureRetroConfig.textureIntensity}%
                </span>
              </div>
              <Slider
                aria-label={t('settings.appearance.retroTextureIntensity')}
                disabled={futureRetroConfig.textureStyle === 'none'}
                value={[futureRetroConfig.textureIntensity]}
                min={10}
                max={100}
                step={1}
                onValueChange={([textureIntensity]) =>
                  updateFutureRetroConfig({ textureIntensity })
                }
              />
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="bg-card rounded-lg border p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <Label>{t('settings.appearance.retroPanelDepth')}</Label>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {t('settings.appearance.retroPanelDepthDesc')}
                  </p>
                </div>
                <span className="text-muted-foreground text-sm">
                  {futureRetroConfig.panelDepth}%
                </span>
              </div>
              <Slider
                aria-label={t('settings.appearance.retroPanelDepth')}
                value={[futureRetroConfig.panelDepth]}
                min={0}
                max={100}
                step={1}
                onValueChange={([panelDepth]) => updateFutureRetroConfig({ panelDepth })}
              />
            </div>

            <div className="bg-card rounded-lg border p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <Label>{t('settings.appearance.retroStrokeScale')}</Label>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {t('settings.appearance.retroStrokeScaleDesc')}
                  </p>
                </div>
                <span className="text-muted-foreground text-sm">
                  {futureRetroConfig.strokeScale}%
                </span>
              </div>
              <Slider
                aria-label={t('settings.appearance.retroStrokeScale')}
                value={[futureRetroConfig.strokeScale]}
                min={50}
                max={100}
                step={1}
                onValueChange={([strokeScale]) => updateFutureRetroConfig({ strokeScale })}
              />
            </div>
          </div>
        </div>
      {/* 动效设置 */}
      <div>
        <h3 className="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">
          {t('settings.appearance.animationEffect')}
        </h3>
        <div className="space-y-2 sm:space-y-3">
          {/* 全局动画开关 */}
          <div className="bg-card rounded-lg border p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 space-y-0.5">
                <Label htmlFor="animations" className="cursor-pointer text-base font-medium">
                  {t('settings.appearance.enableAnimations')}
                </Label>
                <p className="text-muted-foreground text-sm">
                  {t('settings.appearance.enableAnimationsDesc')}
                </p>
              </div>
              <Switch
                id="animations"
                checked={enableAnimations}
                onCheckedChange={setEnableAnimations}
              />
            </div>
          </div>
        </div>
      </div>


 </div>
}
