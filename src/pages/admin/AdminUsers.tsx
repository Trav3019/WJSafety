import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, X, UserRound, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Profile, UserRole } from '../../lib/types'

export default function AdminUsers() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setUsers(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function setStatus(id: string, status: 'approved' | 'rejected') {
    await supabase.from('profiles').update({ status }).eq('id', id)
    load()
  }

  async function setRole(id: string, role: UserRole) {
    await supabase.from('profiles').update({ role }).eq('id', id)
    load()
  }

  async function deleteUser(id: string, name: string) {
    if (!confirm(`Delete user "${name}"? They can re-register in the future.`)) return
    await supabase.rpc('delete_user_account', { target_user_id: id })
    setUsers((u) => u.filter((x) => x.id !== id))
  }

  return (
    <div>
      <Link to="/admin" className="text-emerald-700 text-sm mb-3 inline-flex items-center gap-1 font-medium">
        <ArrowLeft size={15} />
        Admin
      </Link>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Manage Users</h1>
      {loading && <p className="text-gray-500">Loading…</p>}
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-3.5">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 text-emerald-700 rounded-full p-2 shrink-0">
                <UserRound size={18} />
              </div>
              <p className="font-medium text-gray-800 flex-1 truncate">{u.full_name}</p>
              <span
                className={`text-xs font-medium rounded-full px-2 py-0.5 shrink-0 ${
                  u.status === 'approved'
                    ? 'bg-emerald-100 text-emerald-700'
                    : u.status === 'rejected'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                }`}
              >
                {u.status}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <select
                value={u.role}
                onChange={(e) => setRole(u.id, e.target.value as UserRole)}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
              >
                <option value="worker">Worker</option>
                <option value="manager">Manager</option>
                <option value="safety_officer">Safety Officer</option>
                <option value="admin">Admin</option>
              </select>
              {u.status !== 'approved' && (
                <button
                  onClick={() => setStatus(u.id, 'approved')}
                  className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2.5 py-1.5 font-medium transition-colors"
                >
                  <Check size={13} />
                  Approve
                </button>
              )}
              {u.status !== 'rejected' && (
                <button
                  onClick={() => setStatus(u.id, 'rejected')}
                  className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg px-2.5 py-1.5 font-medium transition-colors"
                >
                  <X size={13} />
                  Reject
                </button>
              )}
              <button
                onClick={() => deleteUser(u.id, u.full_name)}
                className="ml-auto flex items-center gap-1 text-xs text-red-500 hover:bg-red-50 rounded-lg px-2.5 py-1.5 font-medium transition-colors"
              >
                <Trash2 size={13} />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
