import { createContext } from 'react'

export const ChatContext = createContext({
  isOpen: false,
  openChat: () => {},
  closeChat: () => {},
  messages: [],
  sendMessage: async () => {},
  isStreaming: false,
  rateLimitRemaining: null,
  error: null,
  clearError: () => {},
  sessionId: '',
})
