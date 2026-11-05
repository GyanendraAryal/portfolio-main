/**
 * Welcome-state suggested questions.
 * Rendered only when there are no messages yet.
 */

const SUGGESTIONS = [
  'What technologies do you work with?',
  'Tell me about your recent work experience.',
  'What projects have you built?',
  'What is your educational background?',
]

export default function SuggestedQuestions({ onSelect }) {
  return (
    <div className="px-4 pb-2">
      <p className="text-xs text-[var(--color-text-muted)] mb-2 uppercase tracking-widest font-semibold">
        Try asking
      </p>
      <div className="flex flex-col gap-2">
        {SUGGESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onSelect(q)}
            className="text-left text-sm px-3 py-2 rounded-lg
              border border-[var(--color-border)] bg-[var(--color-bg-elevated)]
              text-[var(--color-text-secondary)]
              hover:border-orange-500/50 hover:text-[var(--color-text-primary)]
              hover:bg-[var(--color-bg-subtle)]
              transition-all duration-150 cursor-pointer"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}
