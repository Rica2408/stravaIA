import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import api from '@/services/api'
import { ChatMessage } from '@/components/ChatMessage'
import type { CoachMessage } from '@/components/types'

export function Coach() {
  const navigate = useNavigate()
  const location = useLocation()
  const preset = (location.state as { preset?: string } | null)?.preset
  const [messages, setMessages] = useState<CoachMessage[]>([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (preset) {
      setInput(preset)
    }
  }, [preset])

  const load = async () => {
    const [hist, pro] = await Promise.all([
      api.get<{ items: CoachMessage[] }>('/api/coach/history'),
      api.get<{ items: CoachMessage[] }>('/api/coach/proactive'),
    ])
    const byId = new Map<string, CoachMessage>()
    for (const m of [...hist.data.items, ...pro.data.items]) {
      byId.set(m.id, m)
    }
    const merged = Array.from(byId.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    setMessages(merged)
  }

  useEffect(() => {
    void load().catch(() => {
      setToast('No se pudo cargar el historial')
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, typing])

  const send = async () => {
    const text = input.trim()
    if (!text) {
      return
    }
    setInput('')
    const optimistic: CoachMessage = {
      id: `tmp-${Date.now()}`,
      role: 'USER',
      content: text,
      type: 'CHAT',
      createdAt: new Date().toISOString(),
    }
    setMessages((m) => [...m, optimistic])
    setTyping(true)
    try {
      const res = await api.post<{
        response: string
        planUpdated: boolean
        onTrackStatus: string
      }>('/api/coach/message', { message: text })
      const assistant: CoachMessage = {
        id: `tmp-assistant-${Date.now()}`,
        role: 'ASSISTANT',
        content: res.data.response,
        type: 'CHAT',
        createdAt: new Date().toISOString(),
      }
      setMessages((m) => [...m.filter((x) => x.id !== optimistic.id), optimistic, assistant])
      if (res.data.planUpdated) {
        setToast('El coach ha actualizado tu plan')
        setTimeout(() => setToast(null), 4000)
      }
    } catch {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id))
      setToast('No se pudo enviar el mensaje')
      setTimeout(() => setToast(null), 4000)
    } finally {
      setTyping(false)
    }
  }

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-slate-950 text-slate-100">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-900 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.2em] text-orange-300">Coach con IA</p>
          <h1 className="truncate text-lg font-semibold text-white sm:text-xl">Chat con tu coach</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/perfil"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-700 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:text-sm"
          >
            Perfil
          </Link>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            aria-label="Cerrar el chat y volver al panel principal"
          >
            <span aria-hidden className="text-xl leading-none">
              ×
            </span>
            <span className="hidden sm:inline">Cerrar</span>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-2 pt-2 sm:px-4">
        <div
          ref={scrollRef}
          role="log"
          aria-relevant="additions"
          aria-label="Historial de mensajes con el coach"
          tabIndex={0}
          className="chat-scroll flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-slate-900 bg-slate-900/40 p-3 sm:p-4"
        >
          <div className="mt-auto space-y-1">
            {messages.map((m) => (
              <ChatMessage key={m.id} message={m} />
            ))}
            {typing ? (
              <p className="text-xs text-slate-500" role="status" aria-live="polite">
                El coach está escribiendo…
              </p>
            ) : null}
            <div ref={bottomRef} className="h-px w-full shrink-0" aria-hidden />
          </div>
        </div>
      </div>

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed left-1/2 z-50 max-w-[min(90vw,20rem)] -translate-x-1/2 rounded-full bg-emerald-700 px-4 py-2 text-center text-xs font-semibold text-white shadow-lg"
          style={{ bottom: 'max(5.5rem, calc(env(safe-area-inset-bottom, 0px) + 4.5rem))' }}
        >
          {toast}
        </div>
      ) : null}

      <footer className="shrink-0 border-t border-slate-900 bg-slate-950/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-4">
        <form
          className="mx-auto flex max-w-3xl gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <label htmlFor="coach-message-input" className="sr-only">
            Escribe un mensaje para el coach
          </label>
          <textarea
            id="coach-message-input"
            rows={1}
            className="max-h-32 min-h-[44px] flex-1 resize-y rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-base text-white outline-none focus:border-strava focus:ring-1 focus:ring-strava sm:text-sm"
            placeholder="Escribe a tu coach…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            autoComplete="off"
            autoCorrect="on"
            spellCheck={true}
            enterKeyHint="send"
            inputMode="text"
          />
          <button
            type="submit"
            className="min-h-[44px] shrink-0 rounded-xl bg-strava px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-50"
            disabled={!input.trim() || typing}
            aria-busy={typing}
          >
            Enviar
          </button>
        </form>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-slate-500">
          Pulsa Intro para enviar; Mayús+Intro para salto de línea.
        </p>
      </footer>
    </div>
  )
}
