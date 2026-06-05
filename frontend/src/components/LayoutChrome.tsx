import { useCallback, useEffect, useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '@/services/api'
import { useAuthStore } from '@/store/auth.store'

interface LayoutChromeProps {
  /** Texto pequeño encima del título (marca o sección) */
  eyebrow?: string
  /** Título principal de la página */
  title: string
  children: React.ReactNode
  /** Acciones opcionales a la derecha del título (solo escritorio) */
  headerExtra?: React.ReactNode
}

const navLinkClass =
  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-3 text-sm font-medium text-slate-200 hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950'

const drawerLinkClass =
  'flex min-h-[48px] items-center rounded-xl px-4 text-base font-medium text-slate-100 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500'

export function LayoutChrome({ eyebrow, title, children, headerExtra }: LayoutChromeProps) {
  const navigate = useNavigate()
  const setToken = useAuthStore((s) => s.setToken)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navId = useId()

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  useEffect(() => {
    if (!drawerOpen) {
      return
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDrawer()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [drawerOpen, closeDrawer])

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // seguimos limpiando token local
    }
    setToken(null)
    closeDrawer()
    navigate('/login')
  }

  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      <header className="border-b border-slate-900 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:py-4">
          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-800 text-slate-200 hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 md:hidden"
            aria-expanded={drawerOpen}
            aria-controls={navId}
            aria-label={drawerOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
            onClick={() => setDrawerOpen((o) => !o)}
          >
            <span aria-hidden className="text-xl font-bold leading-none">
              ≡
            </span>
          </button>

          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <p className="text-xs uppercase tracking-[0.2em] text-orange-300">{eyebrow}</p>
            ) : null}
            <h1 className="truncate text-base font-semibold text-white sm:text-lg">{title}</h1>
          </div>

          <div className="hidden items-center gap-1 md:flex md:flex-wrap md:justify-end">
            <nav className="flex flex-wrap items-center gap-1" aria-label="Navegación principal">
              <Link to="/" className={navLinkClass}>
                Inicio
              </Link>
              <Link to="/coach" className={navLinkClass}>
                Chat coach
              </Link>
              <Link to="/plan" className={navLinkClass}>
                Plan 3 semanas
              </Link>
              <Link to="/perfil" className={navLinkClass}>
                Perfil
              </Link>
            </nav>
            {headerExtra ? <div className="ml-2 flex items-center gap-2 border-l border-slate-800 pl-2">{headerExtra}</div> : null}
            <button
              type="button"
              onClick={() => void handleLogout()}
              className={`${navLinkClass} border border-slate-800 text-slate-300 hover:border-strava hover:text-white`}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Cerrar menú"
            onClick={closeDrawer}
          />
          <nav
            id={navId}
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
            className="absolute left-0 top-0 flex h-full w-[min(100%,20rem)] flex-col border-r border-slate-800 bg-slate-950 pt-[max(1rem,env(safe-area-inset-top))] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-4 pb-3">
              <p className="text-sm font-semibold text-white">Menú</p>
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] rounded-lg text-2xl leading-none text-slate-400 hover:text-white"
                onClick={closeDrawer}
                aria-label="Cerrar menú"
              >
                ×
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Link to="/" className={drawerLinkClass} onClick={closeDrawer}>
                Inicio
              </Link>
              <Link to="/coach" className={drawerLinkClass} onClick={closeDrawer}>
                Chat con el coach
              </Link>
              <Link to="/plan" className={drawerLinkClass} onClick={closeDrawer}>
                Plan de 3 semanas
              </Link>
              <Link to="/perfil" className={drawerLinkClass} onClick={closeDrawer}>
                Perfil en Strava
              </Link>
              <hr className="my-2 border-slate-800" />
              <button type="button" className={drawerLinkClass} onClick={() => void handleLogout()}>
                Cerrar sesión
              </button>
            </div>
          </nav>
        </div>
      ) : null}

      {children}
    </div>
  )
}
