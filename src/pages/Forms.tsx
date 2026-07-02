import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PenLine, CheckCircle2, PartyPopper, FileSignature } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { FormAssignment } from '../lib/types'

interface SignAssignment {
  id: string
  status: string
  signed_at: string | null
  sign_requests: { title: string }
}

export default function Forms() {
  const { profile } = useAuth()
  const location = useLocation()
  const [assignments, setAssignments] = useState<FormAssignment[]>([])
  const [signAssignments, setSignAssignments] = useState<SignAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const justSigned = (location.state as { signed?: boolean } | null)?.signed

  useEffect(() => {
    if (!profile) return
    Promise.all([
      supabase
        .from('form_assignments')
        .select('*, form_templates(*)')
        .eq('assigned_to', profile.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('sign_assignments')
        .select('*, sign_requests(title)')
        .eq('assigned_to', profile.id)
        .order('created_at', { ascending: false }),
    ]).then(([{ data: forms }, { data: signs }]) => {
      setAssignments((forms as unknown as FormAssignment[]) ?? [])
      setSignAssignments((signs as unknown as SignAssignment[]) ?? [])
      setLoading(false)
    })
  }, [profile])

  const pendingForms = assignments.filter((a) => a.status === 'assigned')
  const doneForms = assignments.filter((a) => a.status === 'submitted')
  const pendingSigns = signAssignments.filter((a) => a.status === 'pending')
  const doneSigns = signAssignments.filter((a) => a.status === 'signed')

  const anyPending = pendingForms.length > 0 || pendingSigns.length > 0
  const anyDone = doneForms.length > 0 || doneSigns.length > 0

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Forms</h1>
      <p className="text-sm text-gray-500 mb-4">Sign and submit forms sent to you.</p>

      {justSigned && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-sm text-emerald-700 font-medium">
          Document signed successfully!
        </div>
      )}

      {loading && <p className="text-gray-500">Loading…</p>}

      {!loading && (
        <>
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Needs your signature</h2>
          {!anyPending && (
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-6 bg-white border border-gray-100 rounded-xl p-4">
              <PartyPopper size={18} />
              Nothing pending right now.
            </div>
          )}
          <div className="space-y-2 mb-6">
            {pendingForms.map((a) => (
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
                  <p className="text-xs text-amber-600 mt-0.5">Fill-in form</p>
                  {a.due_date && <p className="text-xs text-amber-700">Due {a.due_date}</p>}
                </div>
              </Link>
            ))}
            {pendingSigns.map((a) => (
              <Link
                key={a.id}
                to={`/sign/${a.id}`}
                className="bg-amber-50 border border-amber-200 rounded-xl shadow-sm p-3.5 flex items-center gap-3 hover:shadow-md transition-shadow"
              >
                <div className="bg-amber-100 text-amber-700 rounded-full p-2 shrink-0">
                  <FileSignature size={18} />
                </div>
                <div>
                  <p className="font-medium text-gray-800">{a.sign_requests?.title}</p>
                  <p className="text-xs text-amber-600 mt-0.5">PDF to sign</p>
                </div>
              </Link>
            ))}
          </div>

          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Completed</h2>
          {!anyDone && <p className="text-gray-400 text-sm">No completed forms yet.</p>}
          <div className="space-y-2">
            {doneForms.map((a) => (
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
            {doneSigns.map((a) => (
              <div key={a.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-3.5 flex items-center gap-3">
                <div className="bg-emerald-50 text-emerald-700 rounded-full p-2 shrink-0">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <p className="font-medium text-gray-700">{a.sign_requests?.title}</p>
                  <p className="text-xs text-emerald-600">
                    Signed {a.signed_at ? new Date(a.signed_at).toLocaleDateString() : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
