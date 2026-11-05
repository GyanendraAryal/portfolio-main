import { useState } from 'react'
import { Copy, Check, AlertCircle } from 'lucide-react'
import TypingIndicator from './TypingIndicator'

/**
 * Renders a single chat message bubble.
 *
 * - User messages: right-aligned, orange accent.
 * - Assistant messages: left-aligned, surface bg.
 * - Streamed text renders incrementally (content updates via state).
 * - Markdown-safe: renders plain text only — no dangerouslySetInnerHTML.
 * - Copy button on assistant answers.
 * - Error state shows an alert icon.
 */
export default function ChatMessage({ message }) {
  const { role, content, streaming, error } = message
  const isUser = role === 'user'
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div
      className={`flex w-full mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`group relative max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
          ${isUser
            ? 'bg-orange-500 text-white rounded-br-sm'
            : 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-bl-sm'
          }
          ${error ? 'border-red-500/50 bg-red-500/10' : ''}
        `}
        aria-live={!isUser ? 'polite' : undefined}
      >
        {/* Typing indicator while streaming with no content yet */}
        {!isUser && streaming && !content && <TypingIndicator />}

        {/* Error state */}
        {error && (
          <span className="flex items-center gap-1.5 text-red-400 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Failed to get a response. Please try again.
          </span>
        )}

        {/* Message text — plain text only (no HTML injection) */}
        {!error && content && (
          <span className="whitespace-pre-wrap break-words">{content}</span>
        )}

        {/* Streaming cursor */}
        {!isUser && streaming && content && (
          <span className="inline-block w-0.5 h-3.5 bg-orange-400 ml-0.5 align-middle animate-pulse" />
        )}

        {/* Copy button — assistant only, show on hover */}
        {!isUser && !streaming && content && !error && (
          <button
            onClick={handleCopy}
            aria-label="Copy response"
            className="absolute -top-2 -right-2 p-1 rounded-md
              bg-[var(--color-bg-elevated)] border border-[var(--color-border)]
              text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]
              opacity-0 group-hover:opacity-100 focus-visible:opacity-100
              transition-opacity duration-150"
          >
            {copied
              ? <Check className="w-3 h-3 text-orange-400" />
              : <Copy className="w-3 h-3" />
            }
          </button>
        )}
      </div>
    </div>
  )
}
