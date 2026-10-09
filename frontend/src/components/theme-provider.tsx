import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { ThemeProviderContext } from '@/lib/theme-context'
import { buildFutureRetroTexture } from '@/lib/theme/future-retro'
import { DEFAULT_DASHBOARD_STYLE, DEFAULT_FUTURE_RETRO_STYLE_CONFIG } from '@/lib/theme/tokens'
import type { UserThemeConfig } from '@/lib/theme/tokens'
import {
  THEME_STORAGE_KEYS,
  loadThemeConfig,
  resetThemeToDefault,
  saveThemePartial,
} from '@/lib/theme/storage'
import { applyThemePipeline, removeCustomCSS } from '@/lib/theme/pipeline'

type Theme = 'dark' | 'light' | 'system'

type ThemeProviderProps = {
  children: ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: ThemeProviderProps) {
  const [themeMode, setThemeMode] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEYS.MODE) as Theme | null
    return saved || defaultTheme
  })
  const [themeConfig, setThemeConfig] = useState<UserThemeConfig>(() => loadThemeConfig())
  const [systemThemeTick, setSystemThemeTick] = useState(0)

  const resolvedTheme = useMemo<'dark' | 'light'>(() => {
    void systemThemeTick
    if (themeMode !== 'system') return themeMode
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }, [themeMode, systemThemeTick])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (themeMode === 'system') {
        setSystemThemeTick((prev) => prev + 1)
      }
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [themeMode])

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(resolvedTheme)

    const isDark = resolvedTheme === 'dark'
    const dashboardStyle = DEFAULT_DASHBOARD_STYLE
    const futureRetroConfig = {
      ...DEFAULT_FUTURE_RETRO_STYLE_CONFIG,
      ...themeConfig.styleConfig?.futureRetro,
    }

    root.dataset.dashboardStyle = dashboardStyle
    root.dataset.retroTextureStyle = futureRetroConfig.textureStyle
    root.style.setProperty('--retro-paper-warmth', `${futureRetroConfig.paperWarmth}%`)
    root.style.setProperty('--retro-panel-depth', String(futureRetroConfig.panelDepth / 100))
    root.style.setProperty('--retro-stroke-scale', String(futureRetroConfig.strokeScale / 100))
    root.style.setProperty(
      '--retro-configured-paper-texture',
      buildFutureRetroTexture(
        futureRetroConfig.textureStyle,
        futureRetroConfig.textureIntensity,
        isDark
      )
    )
    const textureSize = {
      fine: '180px 180px',
      coarse: '260px 260px',
      'dot-grid': '24px 24px',
      ruled: '40px 28px',
      none: 'auto',
    }[futureRetroConfig.textureStyle]
    root.style.setProperty('--retro-paper-texture-size', textureSize)

    applyThemePipeline(themeConfig, isDark)
  }, [resolvedTheme, themeConfig])

  const setTheme = useCallback((mode: Theme) => {
    localStorage.setItem(THEME_STORAGE_KEYS.MODE, mode)
    setThemeMode(mode)
  }, [])

  const updateThemeConfig = useCallback((partial: Partial<UserThemeConfig>) => {
    saveThemePartial({...partial,dashboardStyle:DEFAULT_DASHBOARD_STYLE})
    setThemeConfig(loadThemeConfig())
  }, [])
  const resetTheme = useCallback(() => {
    resetThemeToDefault()
    removeCustomCSS()
    setThemeConfig(loadThemeConfig())
  }, [])

  const value = useMemo(
    () => ({
      theme: themeMode,
      resolvedTheme,
      setTheme,
      themeConfig,
      updateThemeConfig,
      resetTheme,
    }),
    [themeMode, resolvedTheme, setTheme, themeConfig, updateThemeConfig, resetTheme]
  )

  return <ThemeProviderContext value={value}>{children}</ThemeProviderContext>
}
