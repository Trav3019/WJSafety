import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Home, FileText, ClipboardCheck, ShieldCheck, LogOut, Bell, AlertTriangle, CalendarDays } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import NotificationPrompt from './NotificationPrompt'
import NotificationHistory from './NotificationHistory'
import { supabase } from '../lib/supabase'
import { cacheFile, isCached } from '../lib/offlineDb'

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/documents', label: 'Docs', icon: FileText },
  { to: '/forms', label: 'Forms', icon: ClipboardCheck },
  { to: '/time-off', label: 'Time Off', icon: CalendarDays },
  { to: '/incident-report', label: 'Report', icon: AlertTriangle },
]

async function syncAllDocumentsOffline() {
  const { data: docs } = await supabase.from('documents').select('storage_path')
  if (!docs) return
  for (const doc of docs) {
    if (await isCached(doc.storage_path)) continue
    const { data } = await supabase.storage.from('documents').download(doc.storage_path)
    if (data) await cacheFile(doc.storage_path, data)
  }
}

export default function Layout() {
  const { profile, isAdmin, signOut } = useAuth()
  const [showNotifHistory, setShowNotifHistory] = useState(false)

  useEffect(() => {
    if (profile?.status === 'approved') {
      syncAllDocumentsOffline()
    }
  }, [profile?.id])

  return (
    <div className="min-h-full flex flex-col bg-gray-50">
      {showNotifHistory && <NotificationHistory onClose={() => setShowNotifHistory(false)} />}
      <header className="bg-emerald-800 text-white sticky top-0 z-10 shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={22} className="text-emerald-300" />
            <span className="font-semibold text-lg tracking-tight">WJ Safety</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden sm:inline text-emerald-100">{profile?.full_name}</span>
            <button
              onClick={() => setShowNotifHistory(true)}
              aria-label="Notification history"
              className="flex items-center justify-center bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
            >
              <Bell size={16} />
            </button>
            <button
              onClick={signOut}
              aria-label="Sign out"
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors"
            >
              <LogOut size={14} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <NotificationPrompt />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 pb-28">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.04)] z-10 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-4xl mx-auto flex justify-around py-1.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 text-xs px-4 py-1.5 rounded-lg min-w-16 font-medium transition-colors ${
                  isActive ? 'text-emerald-700 bg-emerald-50' : 'text-gray-500'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 text-xs px-4 py-1.5 rounded-lg min-w-16 font-medium transition-colors ${
                  isActive ? 'text-emerald-700 bg-emerald-50' : 'text-gray-500'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <ShieldCheck size={20} strokeWidth={isActive ? 2.4 : 2} />
                  Admin
                </>
              )}
            </NavLink>
          )}
        </div>
      </nav>
    </div>
  )
}
