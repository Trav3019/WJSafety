import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Clock, UserRound, Download, Trash2, Search, X, FileText, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../lib/types'

interface SignAssignment {
  id: string
  status: string
  signed_at: string | null
  signature_path: string | null
  signed_pdf_path: string | null
  assigned_to: string
  sign_requests: { id: string; title: string; pdf_path: string }
  profiles?: { full_name: string } | null
}

function WorkerDetail() {
  const { workerId } = useParams()
  const [worker, setWorker] = useState<Profile | null>(null)
  const [signs, setSigns] = useState<SignAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!workerId) return
    Promise.all([
      supabase.from('profiles').select('*').eq('id', workerId).single(),
      supabase
        .from('sign_assignments')
        .select('id, status, signed_at, signature_path, signed_pdf_path, assigned_to, sign_requests(id, title, pdf_path)')
        .eq('assigned_to', workerId)
        .order('created_at', { ascending: false }),
    ]).then(([{ data: w }, { data: s }]) => {
      setWorker(w as unknown as Profile)
      setSigns((s as unknown as SignAssignment[]) ?? [])
      setLoading(false)
    })
  }, [workerId])

  async function downloadSignedPdf(signedPdfPath: string, docTitle: string) {
    const { data } = await supabase.storage.from('signed-pdfs').createSignedUrl(signedPdfPath, 60)
    if (!data?.signedUrl) return
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = `${docTitle} - signed.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function deleteSignAssignment(s: SignAssignment) {
    if (!confirm(`Delete "${s.sign_requests?.title}" from this worker's file?`)) return
    if (s.signed_pdf_path) await supabase.storage.from('signed-pdfs').remove([s.signed_pdf_path])
    if (s.signature_path) await supabase.storage.from('signatures').remove([s.signature_path])
    const { error } = await supabase.from('sign_assignments').delete().eq('id', s.id)
    if (error) { alert('Delete failed: ' + error.message); return }
    setSigns((prev) => prev.filter((x) => x.id !== s.id))
  }

  if (loading) return <p className="text-gray-500">Loading…</p>
  if (!worker) return <p className="text-gray-500">Worker not found.</p>

  const filteredSigns = signs.filter((s) =>
    !search.trim() || s.sign_requests?.title?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <Link to="/admin/worker-files" className="text-emerald-700 text-sm mb-3 inline-flex items-center gap-1 font-medium">
        <ArrowLeft size={15} />
        All workers
      </Link>
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-emerald-100 text-emerald-700 rounded-full p-3">
          <UserRound size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{worker.full_name}</h1>
          <p className="text-sm text-gray-500 capitalize">{worker.role}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-500 uppercase">Documents</h2>
        <span className="text-xs text-gray-400">
          {signs.filter((s) => s.status === 'signed').length}/{signs.length} signed
        </span>
      </div>

      {signs.length > 0 && (
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {signs.length === 0 && <p className="text-sm text-gray-400">No documents assigned.</p>}
      {filteredSigns.length === 0 && search && <p className="text-sm text-gray-400">No results for "{search}".</p>}

      <div className="space-y-2">
        {filteredSigns.map((s) => (
          <div key={s.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {s.status === 'signed'
                ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                : <Clock size={18} className="text-amber-500 shrink-0" />
              }
              <div className="min-w-0">
                <p className="font-medium text-gray-800 text-sm truncate">{s.sign_requests?.title}</p>
                <p className="text-xs text-gray-400">
                  {s.status === 'signed'
                    ? `Signed ${s.signed_at ? new Date(s.signed_at).toLocaleDateString() : ''}`
                    : 'Pending'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {s.status === 'signed' && s.signed_pdf_path && (
                <button
                  onClick={() => downloadSignedPdf(s.signed_pdf_path!, s.sign_requests?.title ?? 'document')}
                  className="text-gray-400 hover:text-emerald-700 transition-colors"
                  title="Download signed PDF"
                >
                  <Download size={16} />
                </button>
              )}
              <button
                onClick={() => deleteSignAssignment(s)}
                className="text-gray-300 hover:text-red-500 transition-colors"
                title="Delete from file"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface SignRequest {
  id: string
  title: string
  created_at: string
  sign_assignments: (SignAssignment & { profiles?: { full_name: string } | null })[]
}

export default function AdminWorkerFiles() {
  const { workerId } = useParams()
  const [workers, setWorkers] = useState<Profile[]>([])
  const [signRequests, setSignRequests] = useState<SignRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'by-worker' | 'by-document'>('by-worker')
  const [workerSearch, setWorkerSearch] = useState('')
  const [docSearch, setDocSearch] = useState('')

  useEffect(() => {
    if (workerId) return
    Promise.all([
      supabase.from('profiles').select('*').eq('status', 'approved').order('full_name'),
      supabase
        .from('sign_requests')
        .select('id, title, created_at, sign_assignments(id, status, signed_at, signed_pdf_path, signature_path, assigned_to, profiles!assigned_to(full_name))')
        .order('created_at', { ascending: false }),
    ]).then(([{ data: ws }, { data: reqs }]) => {
      setWorkers((ws as unknown as Profile[]) ?? [])
      setSignRequests((reqs as unknown as SignRequest[]) ?? [])
      setLoading(false)
    })
  }, [workerId])

  if (workerId) return <WorkerDetail />

  // Flatten all assignments for by-worker counts
  const allAssignments = signRequests.flatMap((r) => r.sign_assignments ?? [])
  const signCounts: Record<string, { signed: number; total: number }> = {}
  for (const a of allAssignments) {
    if (!signCounts[a.assigned_to]) signCounts[a.assigned_to] = { signed: 0, total: 0 }
    signCounts[a.assigned_to].total++
    if (a.status === 'signed') signCounts[a.assigned_to].signed++
  }

  const filteredWorkers = workers.filter((w) =>
    !workerSearch.trim() || w.full_name.toLowerCase().includes(workerSearch.toLowerCase())
  )

  // By-document: already grouped by sign_requests
  const docs = signRequests
    .filter((r) => !docSearch.trim() || r.title.toLowerCase().includes(docSearch.toLowerCase()))
    .map((r) => ({ title: r.title, assignments: r.sign_assignments ?? [] }))

  return (
    <div>
      <Link to="/admin" className="text-emerald-700 text-sm mb-3 inline-flex items-center gap-1 font-medium">
        <ArrowLeft size={15} />
        Admin
      </Link>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Worker Files</h1>

      {/* View toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
        <button
          onClick={() => setView('by-worker')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
            view === 'by-worker' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'
          }`}
        >
          <Users size={14} />
          By Worker
        </button>
        <button
          onClick={() => setView('by-document')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
            view === 'by-document' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'
          }`}
        >
          <FileText size={14} />
          By Document
        </button>
      </div>

      {loading && <p className="text-gray-500">Loading…</p>}

      {!loading && view === 'by-worker' && (
        <>
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={workerSearch}
              onChange={(e) => setWorkerSearch(e.target.value)}
              placeholder="Search workers…"
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
            {workerSearch && (
              <button onClick={() => setWorkerSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="space-y-2">
            {filteredWorkers.map((w) => {
              const c = signCounts[w.id]
              return (
                <Link
                  key={w.id}
                  to={`/admin/worker-files/${w.id}`}
                  className="bg-white border border-gray-100 rounded-xl shadow-sm p-3.5 flex items-center gap-3 hover:border-emerald-300 hover:shadow-md transition-all"
                >
                  <div className="bg-emerald-50 text-emerald-700 rounded-full p-2.5 shrink-0">
                    <UserRound size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800">{w.full_name}</p>
                    <p className="text-xs text-gray-500 capitalize">{w.role}</p>
                  </div>
                  {c && (
                    <span className={`text-xs font-medium shrink-0 ${c.signed === c.total ? 'text-emerald-600' : 'text-amber-500'}`}>
                      {c.signed}/{c.total} signed
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </>
      )}

      {!loading && view === 'by-document' && (
        <>
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={docSearch}
              onChange={(e) => setDocSearch(e.target.value)}
              placeholder="Search by document name…"
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
            {docSearch && (
              <button onClick={() => setDocSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>

          {docs.length === 0 && <p className="text-sm text-gray-400">{docSearch ? `No documents matching "${docSearch}".` : 'No documents sent yet.'}</p>}

          <div className="space-y-3">
            {docs.map((doc) => {
              const signed = doc.assignments.filter((a) => a.status === 'signed').length
              const total = doc.assignments.length
              return (
                <div key={doc.title} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                    <p className="font-medium text-gray-800 text-sm">{doc.title}</p>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      signed === total ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {signed}/{total} signed
                    </span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {doc.assignments.map((a) => (
                      <div key={a.id} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm text-gray-700">{(a as SignAssignment & { profiles?: { full_name: string } | null }).profiles?.full_name ?? '—'}</span>
                        {a.status === 'signed' ? (
                          <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                            <CheckCircle2 size={13} />
                            Signed {a.signed_at ? new Date(a.signed_at).toLocaleDateString() : ''}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-500 text-xs font-medium">
                            <Clock size={13} />
                            Pending
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
