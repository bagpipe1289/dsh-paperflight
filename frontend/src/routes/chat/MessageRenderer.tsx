import { Reply as ReplyIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { MarkdownRenderer } from '@/components/markdown-renderer'

import { useChatScroll } from './ChatScrollContext'
import type {
  AtSegmentData,
  ChatMessage,
  MessageSegment,
  ReplySegmentData,
} from './types'

interface MediaSegmentProps {
  segment: MessageSegment
  mediaLabel: string
}

function normalizeAtSegment(segment: MessageSegment): AtSegmentData {
  if (segment.data && typeof segment.data === 'object') {
    return segment.data as AtSegmentData
  }
  return { target_user_id: segment.data == null ? null : String(segment.data) }
}

function normalizeReplySegment(segment: MessageSegment): ReplySegmentData {
  if (segment.data && typeof segment.data === 'object') {
    return segment.data as ReplySegmentData
  }
  return { target_message_id: segment.data == null ? null : String(segment.data) }
}

function MediaSegment({ segment, mediaLabel }: MediaSegmentProps) {
  const { t } = useTranslation()
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const source = String(segment.data)
  const previewTitle = t('chat.media.previewTitle', {
    type: mediaLabel,
    defaultValue: `${mediaLabel}预览`,
  })

  return (
    <>
      <button
        type="button"
        className="focus:ring-ring inline-flex max-w-full cursor-zoom-in rounded-lg border-0 bg-transparent p-0 text-left align-bottom focus:ring-2 focus:ring-offset-2 focus:outline-none"
        aria-label={t('chat.media.openPreview', {
          type: mediaLabel,
          defaultValue: `放大查看${mediaLabel}`,
        })}
        onClick={() => setIsPreviewOpen(true)}
      >
        <img
          src={source}
          alt={mediaLabel}
          className={cn(
            'max-w-full rounded-lg',
            segment.type === 'emoji' ? 'max-h-32' : 'max-h-64'
          )}
          loading="lazy"
          onError={(e) => {
            // 图片加载失败时显示占位符
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
            const fallback = document.createElement('span')
            fallback.className = 'text-muted-foreground text-xs'
            fallback.textContent = t('chat.media.loadFailed', { type: mediaLabel })
            target.parentElement?.appendChild(fallback)
          }}
        />
      </button>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="border-0 bg-black/95 p-2 text-white shadow-2xl [--dialog-width:72rem]">
          <DialogTitle className="sr-only">{previewTitle}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('chat.media.previewDescription', {
              type: mediaLabel,
              defaultValue: `正在查看放大的${mediaLabel}。`,
            })}
          </DialogDescription>
          <div className="flex max-h-[calc(100vh-3rem)] min-h-0 w-full items-center justify-center">
            <img
              src={source}
              alt={mediaLabel}
              className="max-h-[calc(100vh-4rem)] max-w-full rounded-md object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// 渲染单个消息段
export function RenderMessageSegment({ segment }: { segment: MessageSegment }) {
  const { t } = useTranslation()

  switch (segment.type) {
    case 'text':
      return <span className="whitespace-pre-wrap">{String(segment.data)}</span>

    case 'image':
    case 'emoji': {
      const mediaLabel = segment.type === 'emoji' ? t('chat.media.emoji') : t('chat.media.image')

      return <MediaSegment segment={segment} mediaLabel={mediaLabel} />
    }

    case 'voice':
      return (
        <div className="flex items-center gap-2">
          <audio controls src={String(segment.data)} className="h-8 max-w-[200px]">
            <track kind="captions" src="" label={t('chat.media.noCaptions')} default />
            {t('chat.media.audioUnsupported')}
          </audio>
        </div>
      )

    case 'video':
      return (
        <video controls src={String(segment.data)} className="max-h-64 max-w-full rounded-lg">
          <track kind="captions" src="" label={t('chat.media.noCaptions')} default />
          {t('chat.media.videoUnsupported')}
        </video>
      )

    case 'face':
      // QQ 原生表情，显示为文本
      return (
        <span className="text-muted-foreground">
          {t('chat.media.face', { data: String(segment.data) })}
        </span>
      )

    case 'music':
      return <span className="text-muted-foreground">{t('chat.media.music')}</span>

    case 'file':
      return (
        <span className="text-muted-foreground">
          {t('chat.media.file', { data: String(segment.data) })}
        </span>
      )

    case 'reply': {
      const replyData = normalizeReplySegment(segment)
      return <ReplySegmentBlock data={replyData} />
    }

    case 'at': {
      const atData = normalizeAtSegment(segment)
      const atLabel =
        atData.target_user_cardname ||
        atData.target_user_nickname ||
        atData.target_user_id ||
        ''
      return (
        <span
          className="text-primary bg-primary/10 mx-0.5 inline-flex items-center rounded px-1 text-[0.95em] font-medium"
          title={atData.target_user_id ? `@${atData.target_user_id}` : '@'}
        >
          @{atLabel || t('chat.media.unknownMessage')}
        </span>
      )
    }

    case 'forward':
      return <span className="text-muted-foreground">{t('chat.media.forward')}</span>

    case 'unknown':
    default:
      return (
        <span className="text-muted-foreground">
          {t('chat.media.unknown', {
            type: segment.original_type || t('chat.media.unknownMessage'),
          })}
        </span>
      )
  }
}

// 渲染消息内容（支持富文本）
export function RenderMessageContent({ message }: { message: ChatMessage }) {
  // 如果是富文本消息，渲染消息段
  if (message.message_type === 'rich' && message.segments && message.segments.length > 0) {
    // 将 reply 段与后续内容拆开，避免回复块与文本出现在同一行上。
    const inlineSegments: MessageSegment[] = []
    const replySegments: MessageSegment[] = []
    for (const segment of message.segments) {
      if (segment.type === 'reply') {
        replySegments.push(segment)
      } else {
        inlineSegments.push(segment)
      }
    }

    return (
      <div className="flex flex-col gap-2">
        {replySegments.map((segment, index) => (
          <RenderMessageSegment key={`reply-${index}`} segment={segment} />
        ))}
        {inlineSegments.length > 0 && (
          <div className="flex flex-wrap items-baseline whitespace-pre-wrap">
            {inlineSegments.map((segment, index) => (
              <RenderMessageSegment key={`inline-${index}`} segment={segment} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // 普通文本消息
  return message.type === 'bot'
    ? <MarkdownRenderer content={message.content} className="[&>p]:my-0 [&>pre]:max-w-full" />
    : <span className="whitespace-pre-wrap">{message.content}</span>
}

// 回复消息块：点击可跳转到原始消息；如原消息不可见则提示错误。
function ReplySegmentBlock({ data }: { data: ReplySegmentData }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const chatScroll = useChatScroll()

  const senderName =
    data.target_message_sender_cardname ||
    data.target_message_sender_nickname ||
    data.target_message_sender_id ||
    t('chat.message.replyUnknownSender', { defaultValue: '未知发送者' })
  const previewText =
    data.target_message_content?.trim() ||
    t('chat.media.replyMissing', { defaultValue: '原消息内容不可用' })
  const targetMessageId = data.target_message_id ? String(data.target_message_id) : ''
  const isClickable = Boolean(targetMessageId && chatScroll)

  const handleClick = () => {
    if (!targetMessageId || !chatScroll) {
      return
    }
    const found = chatScroll.scrollToMessage(targetMessageId)
    if (!found) {
      toast({
        title: t('chat.toast.replyNotFoundTitle', { defaultValue: '原始消息不在当前视图' }),
        description: t('chat.toast.replyNotFoundDescription', {
          defaultValue: '该消息可能已被清除、不在本会话中，或者尚未加载。',
        }),
        variant: 'destructive',
      })
    }
  }

  const className = cn(
    'group block w-full rounded-md border-l-2 border-primary/60 bg-background/40 px-2 py-1 text-left text-xs',
    isClickable && 'cursor-pointer transition hover:bg-background/70'
  )

  const content = (
    <div className="flex items-start gap-2">
      <ReplyIcon className="mt-0.5 h-3 w-3 shrink-0 opacity-70" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-primary/80 truncate text-[11px] font-medium">{senderName}</div>
        <div className="text-muted-foreground truncate">{previewText}</div>
      </div>
    </div>
  )

  if (isClickable) {
    return (
      <button type="button" className={className} onClick={handleClick}>
        {content}
      </button>
    )
  }
  return <div className={className}>{content}</div>
}
