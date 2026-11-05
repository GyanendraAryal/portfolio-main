import { useState, useCallback, useRef, useEffect } from 'react'
import { ChatContext } from './ChatContextValue'
import { streamChat } from '../api/chat'

/** Generate a random session ID for this browser tab. */
function makeSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/** Safe sessionStorage helpers. */
const storage = {
  get(key) {
    try { return JSON.parse(sessionStorage.getItem(key)) } catch { return null }
  },
  set(key, value) {
    try { sessionStorage.setItem(key, JSON.stringify(value)) } catch {}
  },
}

const STORAGE_KEY = 'chat_history'
const SESSION_KEY = 'chat_session_id'

export function ChatProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState(() => storage.get(STORAGE_KEY) || [])
  const [isStreaming, setIsStreaming] = useState(false)
  const [rateLimitRemaining, setRateLimitRemaining] = useState(null)
  const [error, setError] = useState(null)
  const [sessionId] = useState(() => {
    const saved = storage.get(SESSION_KEY)
    const id = saved || makeSessionId()
    storage.set(SESSION_KEY, id)
    return id
  })

  const abortRef = useRef(null)

  // Persist messages to sessionStorage on change
  useEffect(() => {
    storage.set(STORAGE_KEY, messages)
  }, [messages])

  const openChat = useCallback(() => setIsOpen(true), [])
  const closeChat = useCallback(() => {
    setIsOpen(false)
    // Cancel any in-flight stream when panel closes
    abortRef.current?.abort()
  }, [])
  const clearError = useCallback(() => setError(null), [])

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return

    const userMsg = { role: 'user', content: trimmed, id: Date.now() }
    const assistantMsgId = Date.now() + 1

    setMessages(prev => [
      ...prev,
      userMsg,
      { role: 'assistant', content: '', id: assistantMsgId, streaming: true },
    ])
    setIsStreaming(true)
    setError(null)

    abortRef.current = new AbortController()

    try {
      let accumulated = ''

      const { rateLimitRemaining: remaining } = await streamChat(
        trimmed,
        sessionId,
        (token) => {
          accumulated += token
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsgId
                ? { ...m, content: accumulated }
                : m
            )
          )
        },
        abortRef.current.signal,
      )

      // Mark streaming done
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsgId ? { ...m, streaming: false } : m
        )
      )

      if (remaining !== null) setRateLimitRemaining(remaining)

    } catch (err) {
      if (err.name === 'AbortError') {
        // User closed the panel — just clean up
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsgId
              ? { ...m, content: m.content || '…', streaming: false }
              : m
          )
        )
        return
      }

      const friendlyMsg =
        err.code === 'rate_limited'
          ? `Too many messages. Please wait ${err.retryAfter ?? 60} seconds before trying again.`
          : err.message || 'Something went wrong. Please try again.'

      setError(friendlyMsg)
      if (err.remaining !== undefined) setRateLimitRemaining(err.remaining)

      // Replace the placeholder with the error
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsgId
            ? { ...m, content: '', streaming: false, error: true }
            : m
        )
      )
    } finally {
      setIsStreaming(false)
    }
  }, [isStreaming, sessionId])

  return (
    <ChatContext.Provider value={{
      isOpen,
      openChat,
      closeChat,
      messages,
      sendMessage,
      isStreaming,
      rateLimitRemaining,
      error,
      clearError,
      sessionId,
    }}>
      {children}
    </ChatContext.Provider>
  )
}
