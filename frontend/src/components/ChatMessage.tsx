import type { CoachMessage } from './types'

interface ChatMessageProps {
  message: CoachMessage
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'USER'
  const isProactive = message.type === 'PROACTIVE'
  const bubbleLabel = isUser ? 'Tu mensaje' : isProactive ? 'Mensaje proactivo del coach' : 'Respuesta del coach'

  return (
    <div className={`mb-3 flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <article
        aria-label={bubbleLabel}
        className={`max-w-[min(85vw,28rem)] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-md sm:max-w-[80%] ${
          isUser ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-100'
        }`}
      >
        {!isUser && isProactive ? (
          <span className="mb-2 inline-flex rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-200">
            Aviso del coach
          </span>
        ) : null}
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </article>
    </div>
  )
}
