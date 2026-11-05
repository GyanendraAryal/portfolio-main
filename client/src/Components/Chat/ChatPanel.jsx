import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Send, AlertCircle } from 'lucide-react'
import useChat from '../../hooks/useChat'
import ChatMessage from './ChatMessage'
import SuggestedQuestions from './SuggestedQuestions'

const LOW_REMAINING_THRESHOLD = 5

export default function ChatPanel() {
  const {
    closeChat,
    messages,
    sendMessage,
    isStreaming,
    rateLimitRemaining,
    error,
    clearError,
  } = useChat()

  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const panelRef = useRef(null)

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    // Small delay allows the CSS transition to start first
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [])

  // Focus trap: keep focus inside the panel
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return

    const focusable = () =>
      Array.from(
        panel.querySelectorAll(
          'button, [href], input, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.disabled)

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') { closeChat(); return }

      if (e.key === 'Tab') {
        const items = focusable()
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus() }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus() }
        }
      }
    }

    panel.addEventListener('keydown', handleKeyDown)
    return () => panel.removeEventListener('keydown', handleKeyDown)
  }, [closeChat])

  const handleSend = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return
    setInput('')
    clearError()
    sendMessage(trimmed)
  }, [input, isStreaming, sendMessage, clearError])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const showSuggestions = messages.length === 0 && !isStreaming

  return (
    /* Overlay backdrop — mobile full-screen, desktop floating panel */
    <div
      className="fixed inset-0 z-50 flex items-end justify-end
        sm:items-end sm:justify-end
        p-0 sm:p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Resume assistant"
    >
      {/* Backdrop (mobile only) */}
      <div
        className="absolute inset-0 bg-black/40 sm:hidden"
        onClick={closeChat}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        className="relative flex flex-col
          w-full h-full
          sm:w-[420px] sm:h-[600px] sm:max-h-[80vh]
          sm:rounded-2xl
          bg-[var(--color-bg-surface)]
          border border-[var(--color-border)]
          shadow-[0_24px_80px_rgba(0,0,0,0.5)]
          animate-[fadeUp_0.25s_ease-out_both]"
        style={{ '--animate-fade-up': 'fadeUp 0.25s ease-out both' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3
          border-b border-[var(--color-border)] shrink-0">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              Resume Assistant
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Ask me anything about the portfolio owner
            </p>
          </div>
          <button
            onClick={closeChat}
            aria-label="Close chat"
            className="p-1.5 rounded-lg text-[var(--color-text-muted)]
              hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]
              transition-colors duration-150"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Rate limit banner ── */}
        {rateLimitRemaining !== null && rateLimitRemaining <= LOW_REMAINING_THRESHOLD && (
          <div className="px-4 py-2 bg-orange-500/10 border-b border-orange-500/20 shrink-0">
            <p className="text-xs text-orange-400">
              {rateLimitRemaining === 0
                ? 'Daily message limit reached.'
                : `${rateLimitRemaining} message${rateLimitRemaining !== 1 ? 's' : ''} remaining today.`}
            </p>
          </div>
        )}

        {/* ── Error banner ── */}
        {error && (
          <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 shrink-0
            flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-400 flex-1">{error}</p>
            <button
              onClick={clearError}
              aria-label="Dismiss error"
              className="text-red-400 hover:text-red-300 text-xs underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Welcome message ── */}
        {messages.length === 0 && (
          <div className="px-4 pt-4 pb-2 shrink-0">
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              👋 Hi! I can answer questions about this portfolio owner's skills,
              experience, and projects — all from their resume.
            </p>
          </div>
        )}

        {/* ── Message list ── */}
        <div
          className="flex-1 overflow-y-auto px-4 py-2 scroll-smooth"
          role="log"
          aria-live="polite"
          aria-label="Chat messages"
        >
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* ── Suggested questions ── */}
        {showSuggestions && (
          <SuggestedQuestions
            onSelect={(q) => { clearError(); sendMessage(q) }}
          />
        )}

        {/* ── Input area ── */}
        <div className="px-4 py-3 border-t border-[var(--color-border)] shrink-0">
          <div className="flex items-end gap-2
            bg-[var(--color-bg-elevated)] rounded-xl
            border border-[var(--color-border)]
            focus-within:border-orange-500/50
            transition-colors duration-150">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about skills, experience, projects…"
              rows={1}
              maxLength={500}
              disabled={isStreaming || rateLimitRemaining === 0}
              aria-label="Chat input"
              aria-multiline="true"
              className="flex-1 bg-transparent resize-none
                px-3 py-2.5
                text-sm text-[var(--color-text-primary)]
                placeholder:text-[var(--color-text-muted)]
                focus:outline-none
                disabled:opacity-50 disabled:cursor-not-allowed
                max-h-32 overflow-y-auto"
              style={{ fieldSizing: 'content' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming || rateLimitRemaining === 0}
              aria-label="Send message"
              className="m-1.5 p-1.5 rounded-lg
                bg-orange-500 hover:bg-orange-600
                text-white
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors duration-150 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-1 text-[10px] text-[var(--color-text-muted)] text-right">
            Enter to send · Shift+Enter for newline
          </p>
        </div>
      </div>
    </div>
  )
}
