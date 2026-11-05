import { lazy, Suspense } from 'react'
import { MessageCircle, X } from 'lucide-react'
import useChat from '../../hooks/useChat'

// Lazy-load the panel so its JS is not in the initial bundle
const ChatPanel = lazy(() => import('./ChatPanel'))

export default function ChatWidget() {
  const { isOpen, openChat, closeChat } = useChat()

  return (
    <>
      {/* Floating launcher button */}
      <button
        onClick={isOpen ? closeChat : openChat}
        aria-label={isOpen ? 'Close resume assistant' : 'Open resume assistant'}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="fixed bottom-6 right-6 z-40
          w-14 h-14 rounded-full
          bg-orange-500 hover:bg-orange-600
          text-white shadow-[0_8px_32px_rgba(249,115,22,0.35)]
          hover:shadow-[0_8px_40px_rgba(249,115,22,0.5)]
          flex items-center justify-center
          transition-all duration-200
          hover:-translate-y-0.5
          focus-visible:outline-2 focus-visible:outline-orange-400 focus-visible:outline-offset-2"
      >
        {isOpen
          ? <X className="w-5 h-5" />
          : <MessageCircle className="w-5 h-5" />
        }
      </button>

      {/* Chat panel — rendered in a portal-like manner at the bottom of the tree */}
      {isOpen && (
        <Suspense fallback={null}>
          <ChatPanel />
        </Suspense>
      )}
    </>
  )
}
