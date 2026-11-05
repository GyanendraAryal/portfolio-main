/**
 * Animated three-dot typing indicator.
 * Respects prefers-reduced-motion via CSS.
 */
export default function TypingIndicator() {
  return (
    <div
      className="flex items-center gap-1 px-3 py-2"
      role="status"
      aria-label="Assistant is typing"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-orange-400 opacity-60"
          style={{
            animation: 'chatDot 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  )
}
