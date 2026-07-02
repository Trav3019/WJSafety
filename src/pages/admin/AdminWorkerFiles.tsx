import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Clock, UserRound, Download } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../lib/types'

interface SignAssignment {
  id: string
  status: string
  signed_at: string | null
  signature_path: string | null
  sign_requests: { title: string; pdf_path: string }
}

interface FormSubmission {
  id: string
  submitted_at: string
  form_templates?: { title: string }
}

function WorkerDetail() {
  const { workerId } = useParams()
  const [worker, setWorker] = useState<Profile | null>(null)
  const [signs, setSigns] = useState<SignAssignment[]>([])
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workerId) return
    Promise.all([
      supabase.from('profiles').select('*').eq('id', workerId).single(),
      supabase
        .from('sign_assignments')
        .select('*, sign_requests(title, pdf_path)')
        .eq('assigned_to', workerId)
        .order('created_at', { ascending: false }),
      supabase
        .from('form_submissions')
        .select('*, form_templates(title)')
        .eq('submitted_by', workerId)
        .order('submitted_at', { ascending: false }),
    ]).then(([{ data: w }, { data: s }, { data: f }]) => {
      setWorker(w as unknown as Profile)
      setSigns((s as unknown as SignAssignment[]) ?? [])
      setSubmissions((f as unknown as FormSubmission[]) ?? [])
      setLoading(false)
    })
  }, [workerId])

  async function downloadSignature(sigPath: string, workerName: string) {
    const { data } = await supabase.storage.from('signatures').createSignedUrl(sigPath, 60)
    if (!data?.signedUrl) return
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = `${workerName}-signature.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (loading) return <p className="text-gray-500">Loading…</p>
  if (!worker) return <p className="text-gray-500">Worker not found.</p>

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

      <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">PDF Sign Requests</h2>
      {signs.length === 0 && <p className="text-sm text-gray-400 mb-4">No sign requests assigned.</p>}
      <div className="space-y-2 mb-6">
        {signs.map((s) => (
          <div key={s.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {s.status === 'signed' ? (
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              ) : (
                <Clock size={18} className="text-amber-500 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-medium text-gray-800 text-sm truncate">{s.sign_requests?.title}</p>
                <p className="text-xs text-gray-400">
                  {s.status === 'signed'
                    ? `Signed ${s.signed_at ? new Date(s.signed_at).toLocaleDateString() : ''}`
                    : 'Pending'}
                </p>
              </div>
            </div>
            {s.status === 'signed' && s.signature_path && (
              <button
                onClick={() => downloadSignature(s.signature_path!, worker.full_name)}
                className="shrink-0 text-gray-400 hover:text-emerald-700 transition-colors"
                title="Download signature"
              >
                <Download size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Submitted Forms</h2>
      {submissions.length === 0 && <p className="text-sm text-gray-400">No submitted forms.</p>}
      <div className="space-y-2">
        {submissions.map((sub) => (
          <div key={sub.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-3.5 flex items-center gap-3">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <div>
              <p className="font-medium text-gray-800 text-sm">{sub.form_templates?.title ?? 'Form'}</p>
              <p className="text-xs text-gray-400">
                Submitted {new Date(sub.submitted_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminWorkerFiles() {
  const { workerId } = useParams()
  const [workers, setWorkers] = useState<Profile[]>([])
  const [signCounts, setSignCounts] = useState<Record<string, { signed: number; total: number }>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (workerId) return
    Promise.all([
      supabase.from('profiles').select('*').eq('status', 'approved').order('full_name'),
      supabase.from('sign_assignments').select('assigned_to, status'),
    ]).then(([{ data: ws }, { data: asgns }]) => {
      setWorkers((ws as unknown as Profile[]) ?? [])
      const counts: Record<string, { signed: number; total: number }> = {}
      for (const a of (asgns ?? []) as { assigned_to: string; status: string }[]) {
        if (!counts[a.assigned_to]) counts[a.assigned_to] = { signed: 0, total: 0 }
        counts[a.assigned_to].total++
        if (a.status === 'signed') counts[a.assigned_to].signed++
      }
      setSignCounts(counts)
      setLoading(false)
    })
  }, [workerId])

  if (workerId) return <WorkerDetail />

  return (
    <div>
      <Link to="/admin" className="text-emerald-700 text-sm mb-3 inline-flex items-center gap-1 font-medium">
        <ArrowLeft size={15} />
        Admin
      </Link>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Worker Files</h1>
      {loading && <p className="text-gray-500">Loading…</p>}
      <div className="space-y-2">
        {workers.map((w) => {
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
                <span className="text-xs text-gray-500 shrink-0">
                  {c.signed}/{c.total} signed
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
