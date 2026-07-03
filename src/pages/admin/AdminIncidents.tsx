import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, ChevronDown, ChevronUp, Printer, Trash2, UserRound, CheckCircle2, Eye } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatDistanceToNow } from 'date-fns'

interface IncidentReport {
  id: string
  submitted_by: string | null
  data: Record<string, string>
  created_at: string
  reviewed_at: string | null
}

interface WorkerSummary {
  id: string
  full_name: string
  role: string
  total: number
  unreviewed: number
  latest: string
}

const TYPE_COLORS: Record<string, string> = {
  Injury: 'bg-red-100 text-red-700',
  'Near Miss': 'bg-amber-100 text-amber-700',
  'Property Damage': 'bg-orange-100 text-orange-700',
  Environmental: 'bg-blue-100 text-blue-700',
  Other: 'bg-gray-100 text-gray-600',
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="py-2 border-b border-gray-100 last:border-0">
      <p className="text-xs font-semibold text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{value}</p>
    </div>
  )
}

function PrintView({ report }: { report: IncidentReport }) {
  const d = report.data
  return (
    <div id="print-area" className="hidden print:block font-sans p-8 text-sm text-gray-900">
      <div className="flex items-center justify-between border-b-2 border-gray-800 pb-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">WJ Safety — Incident Report</h1>
          <p className="text-gray-500 text-xs mt-0.5">Submitted {new Date(report.created_at).toLocaleString()}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-3">
        {([
          ['Reporter', d.reporter_name],
          ['Phone', d.reporter_phone],
          ['Date of Incident', d.incident_date],
          ['Time', d.incident_time],
          ['Location', d.location],
          ['Type of Incident', d.incident_type],
          ['Medical Treatment', d.medical_treatment],
          ['Equipment Involved', d.equipment_involved],
        ] as [string, string][]).map(([l, v]) => v ? (
          <div key={l}>
            <p className="font-semibold text-gray-500 text-xs uppercase">{l}</p>
            <p className="mt-0.5">{v}</p>
          </div>
        ) : null)}
      </div>
      <div className="mt-6 space-y-4">
        {([
          ['Description of Incident', d.description],
          ['Persons Involved', d.persons_involved],
          ['Witnesses', d.witnesses],
          ['Injury / Illness Details', d.injury_details],
          ['Contributing Factors', d.contributing_factors],
          ['Corrective Actions Taken', d.corrective_actions],
        ] as [string, string][]).map(([l, v]) => v ? (
          <div key={l}>
            <p className="font-semibold text-gray-500 text-xs uppercase border-b border-gray-200 pb-1 mb-1">{l}</p>
            <p className="whitespace-pre-wrap">{v}</p>
          </div>
        ) : null)}
      </div>
      {d.signature_data_url && (
        <div className="mt-6">
          <p className="font-semibold text-gray-500 text-xs uppercase mb-2">Signature</p>
          <img src={d.signature_data_url} alt="Signature" className="h-16 border border-gray-200 rounded p-1" />
        </div>
      )}
    </div>
  )
}

// ── Worker detail view ──────────────────────────────────────────────────────

function WorkerIncidents() {
  const { workerId } = useParams()
  const navigate = useNavigate()
  const [workerName, setWorkerName] = useState('')
  const [workerRole, setWorkerRole] = useState('')
  const [reports, setReports] = useState<IncidentReport[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [printTarget, setPrintTarget] = useState<IncidentReport | null>(null)

  useEffect(() => {
    if (!workerId) return
    Promise.all([
      supabase.from('profiles').select('full_name, role').eq('id', workerId).single(),
      supabase
        .from('incident_reports')
        .select('*')
        .eq('submitted_by', workerId)
        .order('created_at', { ascending: false }),
    ]).then(([{ data: p }, { data: r }]) => {
      setWorkerName((p as { full_name: string })?.full_name ?? 'Unknown')
      setWorkerRole((p as { role: string })?.role ?? '')
      setReports((r as IncidentReport[]) ?? [])
      setLoading(false)
    })
  }, [workerId])

  async function markReviewed(id: string) {
    const now = new Date().toISOString()
    await supabase.from('incident_reports').update({ reviewed_at: now }).eq('id', id)
    setReports((r) => r.map((x) => x.id === id ? { ...x, reviewed_at: now } : x))
  }

  async function deleteReport(id: string) {
    if (!confirm('Delete this incident report?')) return
    await supabase.from('incident_reports').delete().eq('id', id)
    setReports((r) => r.filter((x) => x.id !== id))
  }

  function printReport(report: IncidentReport) {
    setPrintTarget(report)
    setTimeout(() => { window.print(); setPrintTarget(null) }, 100)
  }

  if (loading) return <p className="text-gray-500">Loading…</p>

  return (
    <div>
      {printTarget && <PrintView report={printTarget} />}

      <button
        onClick={() => navigate('/admin/incidents')}
        className="text-emerald-700 text-sm mb-3 inline-flex items-center gap-1 font-medium"
      >
        <ArrowLeft size={15} />
        All workers
      </button>

      <div className="flex items-center gap-3 mb-5">
        <div className="bg-red-100 text-red-600 rounded-full p-3 shrink-0">
          <UserRound size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{workerName}</h1>
          <p className="text-sm text-gray-500 capitalize">{workerRole} · {reports.length} report{reports.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {reports.length === 0 && (
        <p className="text-gray-400 text-sm">No incident reports from this worker.</p>
      )}

      <div className="space-y-2">
        {reports.map((report) => {
          const d = report.data
          const isOpen = expanded === report.id
          const reviewed = !!report.reviewed_at
          const typeColor = TYPE_COLORS[d.incident_type] ?? 'bg-gray-100 text-gray-600'

          return (
            <div
              key={report.id}
              className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-colors ${reviewed ? 'border-gray-100' : 'border-red-200'}`}
            >
              <button
                className="w-full p-4 flex items-start gap-3 text-left"
                onClick={() => setExpanded(isOpen ? null : report.id)}
              >
                <div className={`rounded-full p-2 shrink-0 mt-0.5 ${reviewed ? 'bg-gray-100 text-gray-400' : 'bg-red-50 text-red-600'}`}>
                  {reviewed ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {d.incident_type && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColor}`}>
                        {d.incident_type}
                      </span>
                    )}
                    {!reviewed && (
                      <span className="text-xs font-semibold text-red-500">New</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {d.incident_date}{d.incident_time && ` at ${d.incident_time}`}
                    {d.location && ` · ${d.location}`}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                    {reviewed && ' · Reviewed'}
                  </p>
                </div>
                {isOpen ? <ChevronUp size={16} className="text-gray-400 shrink-0 mt-1" /> : <ChevronDown size={16} className="text-gray-400 shrink-0 mt-1" />}
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 px-4 pb-4">
                  <div className="mt-3">
                    <Row label="Reporter Phone" value={d.reporter_phone} />
                    <Row label="Description" value={d.description} />
                    <Row label="Persons Involved" value={d.persons_involved} />
                    <Row label="Witnesses" value={d.witnesses} />
                    <Row label="Injury / Illness Details" value={d.injury_details} />
                    <Row label="Medical Treatment" value={d.medical_treatment !== 'None' ? d.medical_treatment : undefined} />
                    <Row label="Equipment / Materials Involved" value={d.equipment_involved} />
                    <Row label="Contributing Factors" value={d.contributing_factors} />
                    <Row label="Corrective Actions Taken" value={d.corrective_actions} />
                  </div>

                  {d.signature_data_url && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1">Signature</p>
                      <img src={d.signature_data_url} alt="Signature" className="h-14 border border-gray-200 rounded-lg bg-gray-50 p-1" />
                    </div>
                  )}

                  <div className="flex gap-2 mt-4 flex-wrap">
                    {!reviewed && (
                      <button
                        onClick={() => markReviewed(report.id)}
                        className="flex items-center gap-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Eye size={14} />
                        Mark as Reviewed
                      </button>
                    )}
                    <button
                      onClick={() => printReport(report)}
                      className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Printer size={14} />
                      Print / Save PDF
                    </button>
                    <button
                      onClick={() => deleteReport(report.id)}
                      className="flex items-center gap-1.5 text-sm font-medium text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main worker list view ───────────────────────────────────────────────────

export default function AdminIncidents() {
  const { workerId } = useParams()
  const navigate = useNavigate()
  const [workers, setWorkers] = useState<WorkerSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (workerId) return
    Promise.all([
      supabase.from('incident_reports').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, role'),
    ]).then(([{ data: reports, error: rErr }, { data: profiles, error: pErr }]) => {
      if (rErr) { setLoadError(rErr.message); setLoading(false); return }
      if (pErr) { setLoadError(pErr.message); setLoading(false); return }

      const profileMap: Record<string, { full_name: string; role: string }> = {}
      for (const p of profiles ?? []) profileMap[p.id] = { full_name: p.full_name, role: p.role }

      const map: Record<string, WorkerSummary> = {}
      for (const r of (reports ?? []) as IncidentReport[]) {
        const id = r.submitted_by ?? 'unknown'
        if (!map[id]) {
          map[id] = {
            id,
            full_name: profileMap[id]?.full_name ?? 'Unknown Worker',
            role: profileMap[id]?.role ?? '',
            total: 0,
            unreviewed: 0,
            latest: r.created_at,
          }
        }
        map[id].total++
        if (!r.reviewed_at) map[id].unreviewed++
      }
      setWorkers(Object.values(map).sort((a, b) => b.unreviewed - a.unreviewed || b.latest.localeCompare(a.latest)))
      setLoading(false)
    })
  }, [workerId])

  if (workerId) return <WorkerIncidents />

  const totalUnreviewed = workers.reduce((sum, w) => sum + w.unreviewed, 0)

  return (
    <div>
      <Link to="/admin" className="text-emerald-700 text-sm mb-3 inline-flex items-center gap-1 font-medium">
        <ArrowLeft size={15} />
        Admin
      </Link>
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle size={20} className="text-red-600" />
        <h1 className="text-xl font-bold text-gray-900">Incident Reports</h1>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {totalUnreviewed > 0
          ? `${totalUnreviewed} unreviewed report${totalUnreviewed !== 1 ? 's' : ''}`
          : 'All reports reviewed'}
      </p>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      {!loading && !loadError && workers.length === 0 && (
        <div className="text-center text-gray-400 text-sm bg-white border border-gray-100 rounded-xl p-8">
          No incident reports submitted yet.
        </div>
      )}

      <div className="space-y-2">
        {workers.map((w) => (
          <button
            key={w.id}
            onClick={() => navigate(`/admin/incidents/${w.id}`)}
            className={`w-full bg-white border rounded-xl shadow-sm p-3.5 flex items-center gap-3 hover:shadow-md transition-all text-left ${
              w.unreviewed > 0 ? 'border-red-200 hover:border-red-300' : 'border-gray-100 hover:border-emerald-300'
            }`}
          >
            <div className={`rounded-full p-2.5 shrink-0 ${w.unreviewed > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
              <UserRound size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800">{w.full_name}</p>
              <p className="text-xs text-gray-500 capitalize">{w.role} · {w.total} report{w.total !== 1 ? 's' : ''}</p>
            </div>
            {w.unreviewed > 0 ? (
              <span className="shrink-0 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {w.unreviewed} new
              </span>
            ) : (
              <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
