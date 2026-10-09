import * as React from "react"

import { cn } from "@/lib/utils"

function getScrollContainers(element: HTMLElement) {
  const containers: Array<{ element: HTMLElement; scrollLeft: number; scrollTop: number }> = []
  let current = element.parentElement

  while (current) {
    if (current.scrollHeight > current.clientHeight || current.scrollWidth > current.clientWidth) {
      containers.push({
        element: current,
        scrollLeft: current.scrollLeft,
        scrollTop: current.scrollTop,
      })
    }
    current = current.parentElement
  }

  return containers
}

function restoreScrollContainers(containers: Array<{ element: HTMLElement; scrollLeft: number; scrollTop: number }>) {
  for (const container of containers) {
    container.element.scrollTop = container.scrollTop
    container.element.scrollLeft = container.scrollLeft
  }
}

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  /**
   * 是否启用自动高度调整
   * @default true
   */
  autoResize?: boolean
  /**
   * 最小高度（像素），仅在 autoResize=true 时生效
   * @default 60
   */
  minHeight?: number
  /**
   * 最大高度（像素），仅在 autoResize=true 时生效
   * 设置为 undefined 或 0 表示不限制最大高度
   */
  maxHeight?: number
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autoResize = true, minHeight = 60, maxHeight, value, onChange, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement>(null)
    const [hasFixedHeight, setHasFixedHeight] = React.useState(false)

    // 合并 ref
    React.useImperativeHandle(ref, () => innerRef.current!)

    // 检测是否设置了固定高度
    React.useEffect(() => {
      if (className) {
        // 检查是否包含固定高度的类（如 h-20, h-[200px], min-h-[xxx] 等）
        const hasFixedHeightClass = /\b(h-\d+|h-\[[\d.]+(?:px|rem|em)\]|min-h-\[[\d.]+(?:px|rem|em)\])\b/.test(className)
        setHasFixedHeight(hasFixedHeightClass)
      }
    }, [className])

    // 自动调整高度函数
    const adjustHeight = React.useCallback(() => {
      const textarea = innerRef.current
      if (!textarea || !autoResize || hasFixedHeight) return

      const scrollContainers = getScrollContainers(textarea)

      let scrollHeight = textarea.scrollHeight
      if (scrollHeight < textarea.offsetHeight) {
        // 内容变短时才临时重置高度，避免长文本输入时触发浏览器滚动锚定。
        textarea.style.height = 'auto'
        scrollHeight = textarea.scrollHeight
      }

      // 计算新高度
      let newHeight = Math.max(scrollHeight, minHeight)
      
      // 应用最大高度限制
      if (maxHeight && maxHeight > 0) {
        newHeight = Math.min(newHeight, maxHeight)
      }
      
      textarea.style.height = `${newHeight}px`
      
      // 如果内容超过最大高度，启用滚动
      if (maxHeight && maxHeight > 0 && scrollHeight > maxHeight) {
        textarea.style.overflowY = 'auto'
      } else {
        textarea.style.overflowY = 'hidden'
      }

      restoreScrollContainers(scrollContainers)
    }, [autoResize, hasFixedHeight, minHeight, maxHeight])

    // 监听 value 变化并调整高度
    React.useLayoutEffect(() => {
      adjustHeight()
    }, [value, adjustHeight])

    // 字体和容器布局稳定后再次测量，避免初始 scrollHeight 被算得过高。
    React.useEffect(() => {
      adjustHeight()

      const textarea = innerRef.current
      if (!textarea || !autoResize || hasFixedHeight) return

      const animationFrameId = window.requestAnimationFrame(adjustHeight)
      const resizeObserver = new ResizeObserver(adjustHeight)
      resizeObserver.observe(textarea)
      if (textarea.parentElement) {
        resizeObserver.observe(textarea.parentElement)
      }

      const fonts = document.fonts
      fonts?.ready.then(adjustHeight).catch(() => undefined)

      return () => {
        window.cancelAnimationFrame(animationFrameId)
        resizeObserver.disconnect()
      }
    }, [adjustHeight, autoResize, hasFixedHeight])

    // 处理 onChange 事件
    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange?.(e)
        // 延迟调整高度，确保值已更新
        requestAnimationFrame(() => {
          adjustHeight()
        })
      },
      [onChange, adjustHeight]
    )

    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "custom-scrollbar",
          autoResize && !hasFixedHeight && "resize-none overflow-hidden",
          className
        )}
        ref={innerRef}
        value={value}
        onChange={handleChange}
        style={{
          minHeight: autoResize && !hasFixedHeight ? `${minHeight}px` : undefined,
        }}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
