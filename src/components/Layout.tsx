import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/documents', label: 'Documents' },
  { to: '/forms', label: 'Forms' },
]

export default function Layout() {
  const { profile, isAdmin, signOut } = useAuth()

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-emerald-800 text-white sticky top-0 z-10 shadow">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-semibold text-lg tracking-tight">WJ Safety</span>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline opacity-80">{profile?.full_name}</span>
            <button
              onClick={signOut}
              className="bg-emerald-900/60 hover:bg-emerald-900 px-3 py-1.5 rounded-md"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 pb-24">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex justify-around py-2 z-10">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center text-xs px-3 py-1 rounded-md ${
                isActive ? 'text-emerald-700 font-semibold' : 'text-gray-500'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex flex-col items-center text-xs px-3 py-1 rounded-md ${
                isActive ? 'text-emerald-700 font-semibold' : 'text-gray-500'
              }`
            }
          >
            Admin
          </NavLink>
        )}
      </nav>
    </div>
  )
}
