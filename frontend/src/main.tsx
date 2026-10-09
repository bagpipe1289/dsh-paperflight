import {ReadingRuntime} from './dsh/ReadingSettings'
import {FirstRunNotice} from './dsh/SetupGuide'
import {ShortcutRuntime} from './dsh/Shortcuts'
import {ConnectionStatus} from './dsh/ConnectionStatus'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'

import './index.css'
import './i18n'

import { AnnouncerProvider } from './components/ui/announcer'
import { AssetStoreProvider } from './components/asset-provider'
import { AnimationProvider } from './components/animation-provider'
import { ThemeProvider } from './components/theme-provider'
import { TourProvider } from './components/tour/tour-provider'

import { ErrorBoundary } from './components/error-boundary'
import { Toaster } from './components/ui/toaster'


import { queryClient } from './lib/query'
import { router } from './router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AnnouncerProvider>
          <AssetStoreProvider>
            <ThemeProvider defaultTheme="light">
              
              <AnimationProvider>
                <TourProvider>
                  
                  <RouterProvider router={router} />
                  
                  <Toaster /><ReadingRuntime/><FirstRunNotice/><ShortcutRuntime/><ConnectionStatus/>
                </TourProvider>
              </AnimationProvider>
            </ThemeProvider>
          </AssetStoreProvider>
        </AnnouncerProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
)
