import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute() {
  const { session, profile, loading } = useAuth()

  if (loading) return <div className="p-8 text-center text-gray-500">Loading…</div>
  if (!session) return <Navigate to="/login" replace />
  if (profile && profile.status !== 'approved') return <Navigate to="/pending" replace />

  return <Outlet />
}

export function AdminRoute() {
  const { isAdmin, loading } = useAuth()
  if (loading) return <div className="p-8 text-center text-gray-500">Loading…</div>
  if (!isAdmin) return <Navigate to="/" replace />
  return <Outlet />
}

export function ManagerRoute() {
  const { isManager, loading } = useAuth()
  if (loading) return <div className="p-8 text-center text-gray-500">Loading…</div>
  if (!isManager) return <Navigate to="/" replace />
  return <Outlet />
}
