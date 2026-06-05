import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApiBaseUrl } from '@/lib/apiBaseUrl'
import { useAuthStore } from '@/store/auth.store'

const features = [
  'Plan semanal dinámico basado en tu historial real de Strava.',
  'Coach con Claude que habla español y ajusta el plan cuando la vida se interpone.',
  'Debrief automático tras cada actividad y mensajes proactivos si pierdes el ritmo.',
  'Briefing pre-carrera la noche anterior a tu objetivo.',
  'Seguridad: tokens Strava cifrados en servidor; nunca compartimos tu client secret.',
]

export function Login() {
  const apiUrl = getApiBaseUrl()
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const hydrated = useAuthStore((s) => s.hydrated)

  useEffect(() => {
    if (hydrated && token) {
      navigate('/', { replace: true })
    }
  }, [hydrated, token, navigate])

  const connect = () => {
    if (!apiUrl) {
      alert('Falta configurar VITE_API_URL con la URL del backend en Vercel.')
      return
    }
    window.location.href = `${apiUrl}/auth/strava`
  }

  return (
    <div className="flex min-h-full flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] sm:px-6 sm:py-12 md:flex-row md:items-center">
        <section className="flex-1 space-y-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-300">Strava Coach IA</p>
          <h1 className="text-4xl font-bold leading-tight text-white md:text-5xl">
            Tu plan de carrera, explicado y ajustado por un coach de IA con memoria.
          </h1>
          <p className="text-base text-slate-300">
            Conecta Strava, define un objetivo y deja que el coach traduzca tus datos en decisiones de entrenamiento
            claras, humanas y sostenibles.
          </p>
          <button
            type="button"
            onClick={connect}
            className="inline-flex items-center gap-3 rounded-2xl bg-strava px-8 py-4 text-base font-semibold text-white shadow-xl shadow-orange-900/40 transition hover:bg-orange-600"
          >
            <StravaMark />
            Conectar con Strava
          </button>
          <p className="text-xs text-slate-500">
            Al conectar aceptas que sincronicemos tus actividades para personalizar el plan. Toda la IA se ejecuta en tu
            backend seguro.
          </p>
        </section>
        <section className="flex-1 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl shadow-black/40">
          <h2 className="text-lg font-semibold text-white">Qué incluye</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-200">
            {features.map((f) => (
              <li key={f} className="flex gap-3">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-strava" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <footer className="border-t border-slate-900 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-slate-500 sm:px-6">
        <span className="font-semibold text-slate-300">Funciona con Strava</span>
        {' · '}
        Uso de la API de Strava según sus términos de marca y de desarrollador.
      </footer>
    </div>
  )
}

function StravaMark() {
  return (
    <svg aria-hidden="true" className="h-8 w-8" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="white" />
      <path
        fill="#FC4C02"
        d="M16 4.5c-5.25 0-9.5 4.25-9.5 9.5 0 6.2 9.5 13.5 9.5 13.5s9.5-7.3 9.5-13.5c0-5.25-4.25-9.5-9.5-9.5Zm0 13.25a3.75 3.75 0 1 1 0-7.5 3.75 3.75 0 0 1 0 7.5Z"
      />
    </svg>
  )
}
