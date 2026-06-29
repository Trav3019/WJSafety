import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PenLine, CheckCircle2, PartyPopper } from 'lucide-react'
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
      <h1 className="text-xl font-bold text-gray-900 mb-1">Forms</h1>
      <p className="text-sm text-gray-500 mb-4">Sign and submit forms sent to you.</p>
      {loading && <p className="text-gray-500">Loading…</p>}

      {!loading && (
        <>
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Needs your signature</h2>
          {pending.length === 0 && (
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-6 bg-white border border-gray-100 rounded-xl p-4">
              <PartyPopper size={18} />
              Nothing pending right now.
            </div>
          )}
          <div className="space-y-2 mb-6">
            {pending.map((a) => (
              <Link
                key={a.id}
                to={`/forms/${a.id}`}
                className="bg-amber-50 border border-amber-200 rounded-xl shadow-sm p-3.5 flex items-center gap-3 hover:shadow-md transition-shadow"
              >
                <div className="bg-amber-100 text-amber-700 rounded-full p-2 shrink-0">
                  <PenLine size={18} />
                </div>
                <div>
                  <p className="font-medium text-gray-800">{a.form_templates?.title}</p>
                  {a.due_date && <p className="text-xs text-amber-700">Due {a.due_date}</p>}
                </div>
              </Link>
            ))}
          </div>

          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Completed</h2>
          {done.length === 0 && <p className="text-gray-400 text-sm">No completed forms yet.</p>}
          <div className="space-y-2">
            {done.map((a) => (
              <div key={a.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-3.5 flex items-center gap-3">
                <div className="bg-emerald-50 text-emerald-700 rounded-full p-2 shrink-0">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <p className="font-medium text-gray-700">{a.form_templates?.title}</p>
                  <p className="text-xs text-emerald-600">Submitted</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
