import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'

import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

import { isEditableTarget, matchesShortcut } from '@/lib/keyboard'

import { ScrollArea } from '@/components/ui/scroll-area'

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/80',
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

interface DialogContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  /** 阻止点击外部关闭（用于 Tour 运行时） */
  preventOutsideClose?: boolean
  /** 隐藏默认关闭按钮（当使用自定义关闭按钮时） */
  hideCloseButton?: boolean
  /** 回车触发主操作按钮 */
  confirmOnEnter?: boolean
}

interface DialogBodyProps extends React.ComponentPropsWithoutRef<typeof ScrollArea> {
  allowHorizontalScroll?: boolean
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(
  (
    {
      className,
      children,
      preventOutsideClose = false,
      hideCloseButton = false,
      confirmOnEnter = false,
      onKeyDownCapture,
      ...props
    },
    ref
  ) => (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        data-dashboard-dialog-content="true"
        className={cn(
          'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] fixed top-[50%] left-[50%] z-50 flex max-h-[calc(100vh-2rem)] w-[min(calc(100vw-2rem),var(--dialog-width,32rem))] translate-x-[-50%] translate-y-[-50%] flex-col gap-4 overflow-hidden border p-6 shadow-lg duration-200 sm:rounded-lg',
          className
        )}
        onPointerDownOutside={preventOutsideClose ? (e) => e.preventDefault() : undefined}
        onInteractOutside={preventOutsideClose ? (e) => e.preventDefault() : undefined}
        onKeyDownCapture={(event) => {
          onKeyDownCapture?.(event)
          if (
            !confirmOnEnter ||
            event.defaultPrevented ||
            !matchesShortcut(event, ['enter']) ||
            event.nativeEvent.isComposing ||
            isEditableTarget(event.target)
          ) {
            return
          }

          const confirmButton = event.currentTarget.querySelector<HTMLElement>(
            '[data-dialog-action="confirm"]:not([disabled])'
          )
          if (!confirmButton) {
            return
          }

          event.preventDefault()
          confirmButton.click()
        }}
        {...props}
      >
        {children}
        {!hideCloseButton && (
          <DialogPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">关闭</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
)
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogBody = React.forwardRef<HTMLDivElement, DialogBodyProps>(
  (
    {
      className,
      children,
      allowHorizontalScroll = false,
      contentClassName,
      scrollbars,
      viewportClassName,
      type,
      ...props
    },
    ref
  ) => (
    // 关键：在 flex-col 的 DialogContent 中，DialogBody 既要在内容多时撑到 max-h 上限并滚动，
    // 又要在内容少时让 dialog 自然收缩。直接在 ScrollArea Root 上 flex-1 + min-h-0 即可：
    // Radix Viewport 内部 wrapper 默认 display:table 会撑开自然高度，所以需要强制 block。
    <ScrollArea
      ref={ref as never}
      className={cn('flex min-h-0 flex-1 flex-col', className)}
      contentClassName={cn(allowHorizontalScroll && 'min-w-full w-max', contentClassName)}
      scrollbars={scrollbars ?? (allowHorizontalScroll ? 'both' : 'vertical')}
      viewportClassName={cn('min-h-0 flex-1 pr-4 [&>div]:!block', viewportClassName)}
      type={type ?? 'always'}
      {...props}
    >
      {children}
    </ScrollArea>
  )
)
DialogBody.displayName = 'DialogBody'

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
)
DialogHeader.displayName = 'DialogHeader'

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
)
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg leading-none font-semibold tracking-tight', className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-muted-foreground text-sm', className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
