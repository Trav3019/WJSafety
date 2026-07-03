import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CheckCircle2, PartyPopper, FileSignature, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

interface SignAssignment {
  id: string
  status: string
  signed_at: string | null
  sign_requests: { title: string }
}

export default function Forms() {
  const { profile } = useAuth()
  const location = useLocation()
  const [signAssignments, setSignAssignments] = useState<SignAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const justSigned = (location.state as { signed?: boolean } | null)?.signed

  useEffect(() => {
    if (!profile) return
    supabase
      .from('sign_assignments')
      .select('*, sign_requests(title)')
      .eq('assigned_to', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data: signs }) => {
        setSignAssignments((signs as unknown as SignAssignment[]) ?? [])
        setLoading(false)
      })
  }, [profile])

  const pendingSigns = signAssignments.filter((a) => a.status === 'pending')
  const doneSigns = signAssignments.filter((a) => a.status === 'signed')

  const filteredDone = doneSigns.filter((a) =>
    !search.trim() || a.sign_requests?.title?.toLowerCase().includes(search.toLowerCase())
  )

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
          {pendingSigns.length === 0 && (
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-6 bg-white border border-gray-100 rounded-xl p-4">
              <PartyPopper size={18} />
              Nothing pending right now.
            </div>
          )}
          <div className="space-y-2 mb-6">
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

          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase">Completed</h2>
          </div>

          {doneSigns.length > 0 && (
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search signed documents…"
                className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {doneSigns.length === 0 && <p className="text-gray-400 text-sm">No completed forms yet.</p>}
          {filteredDone.length === 0 && search && <p className="text-gray-400 text-sm">No results for "{search}".</p>}

          <div className="space-y-2">
            {filteredDone.map((a) => (
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
