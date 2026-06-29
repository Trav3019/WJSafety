import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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

  return (
    <div>
      <Link to="/admin" className="text-emerald-700 text-sm mb-3 inline-block">
        ← Admin
      </Link>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Manage Users</h1>
      {loading && <p className="text-gray-500">Loading…</p>}
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="bg-white border border-gray-100 rounded-lg shadow-sm p-3">
            <div className="flex items-center justify-between">
              <p className="font-medium text-gray-800">{u.full_name}</p>
              <span
                className={`text-xs rounded-full px-2 py-0.5 ${
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
            <div className="flex items-center gap-2 mt-2">
              <select
                value={u.role}
                onChange={(e) => setRole(u.id, e.target.value as UserRole)}
                className="text-sm border border-gray-300 rounded-md px-2 py-1"
              >
                <option value="worker">Worker</option>
                <option value="safety_officer">Safety Officer</option>
                <option value="admin">Admin</option>
              </select>
              {u.status !== 'approved' && (
                <button
                  onClick={() => setStatus(u.id, 'approved')}
                  className="text-xs bg-emerald-600 text-white rounded-md px-2.5 py-1.5"
                >
                  Approve
                </button>
              )}
              {u.status !== 'rejected' && (
                <button
                  onClick={() => setStatus(u.id, 'rejected')}
                  className="text-xs bg-gray-100 text-gray-600 rounded-md px-2.5 py-1.5"
                >
                  Reject
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
