import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { FormAssignment } from '../lib/types'

export default function Forms() {
  const { profile } = useAuth()
  const [assignments, setAssignments] = useState<FormAssignment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    supabase
      .from('form_assignments')
      .select('*, form_templates(*)')
      .eq('assigned_to', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setAssignments((data as unknown as FormAssignment[]) ?? [])
        setLoading(false)
      })
  }, [profile])

  const pending = assignments.filter((a) => a.status === 'assigned')
  const done = assignments.filter((a) => a.status === 'submitted')

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Forms</h1>
      {loading && <p className="text-gray-500">Loading…</p>}

      {!loading && (
        <>
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Needs your signature</h2>
          {pending.length === 0 && <p className="text-gray-500 text-sm mb-4">Nothing pending. 🎉</p>}
          <div className="space-y-2 mb-6">
            {pending.map((a) => (
              <Link
                key={a.id}
                to={`/forms/${a.id}`}
                className="bg-white border border-amber-200 bg-amber-50 rounded-lg shadow-sm p-3 block"
              >
                <p className="font-medium text-gray-800">{a.form_templates?.title}</p>
                {a.due_date && <p className="text-xs text-amber-700">Due {a.due_date}</p>}
              </Link>
            ))}
          </div>

          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Completed</h2>
          {done.length === 0 && <p className="text-gray-500 text-sm">No completed forms yet.</p>}
          <div className="space-y-2">
            {done.map((a) => (
              <div key={a.id} className="bg-white border border-gray-100 rounded-lg shadow-sm p-3">
                <p className="font-medium text-gray-700">{a.form_templates?.title}</p>
                <p className="text-xs text-emerald-600">Submitted</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
