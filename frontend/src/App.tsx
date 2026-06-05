import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { Login } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { Coach } from '@/pages/Coach'
import { PlanPage } from '@/pages/Plan'
import { ActivityPage } from '@/pages/Activity'
import { ProfilePage } from '@/pages/Profile'

function RequireAuth() {
  const token = useAuthStore((s) => s.token)
  const hydrated = useAuthStore((s) => s.hydrated)
  const location = useLocation()

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">
        Preparando sesión…
      </div>
    )
  }
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/coach" element={<Coach />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/activity/:id" element={<ActivityPage />} />
        <Route path="/perfil" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
