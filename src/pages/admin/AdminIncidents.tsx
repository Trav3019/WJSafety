import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, ChevronDown, ChevronUp, Printer, Trash2, Search, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatDistanceToNow } from 'date-fns'

interface IncidentReport {
  id: string
  submitted_by: string | null
  data: Record<string, string>
  created_at: string
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
        {[
          ['Reporter', d.reporter_name],
          ['Date of Incident', d.incident_date],
          ['Time', d.incident_time],
          ['Location', d.location],
          ['Type of Incident', d.incident_type],
          ['Medical Treatment', d.medical_treatment],
          ['Equipment Involved', d.equipment_involved],
        ].map(([l, v]) => v ? (
          <div key={l}>
            <p className="font-semibold text-gray-500 text-xs uppercase">{l}</p>
            <p className="mt-0.5">{v}</p>
          </div>
        ) : null)}
      </div>
      <div className="mt-6 space-y-4">
        {[
          ['Description of Incident', d.description],
          ['Persons Involved', d.persons_involved],
          ['Witnesses', d.witnesses],
          ['Injury / Illness Details', d.injury_details],
          ['Contributing Factors', d.contributing_factors],
          ['Corrective Actions Taken', d.corrective_actions],
        ].map(([l, v]) => v ? (
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

export default function AdminIncidents() {
  const [reports, setReports] = useState<IncidentReport[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [printTarget, setPrintTarget] = useState<IncidentReport | null>(null)

  async function load() {
    const { data } = await supabase
      .from('incident_reports')
      .select('*')
      .order('created_at', { ascending: false })
    setReports((data as IncidentReport[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteReport(id: string) {
    if (!confirm('Delete this incident report?')) return
    await supabase.from('incident_reports').delete().eq('id', id)
    setReports((r) => r.filter((x) => x.id !== id))
  }

  function printReport(report: IncidentReport) {
    setPrintTarget(report)
    setTimeout(() => {
      window.print()
      setPrintTarget(null)
    }, 100)
  }

  const filtered = reports.filter((r) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const d = r.data
    return (
      d.reporter_name?.toLowerCase().includes(q) ||
      d.incident_type?.toLowerCase().includes(q) ||
      d.location?.toLowerCase().includes(q) ||
      d.description?.toLowerCase().includes(q)
    )
  })

  return (
    <div>
      {printTarget && <PrintView report={printTarget} />}

      <Link to="/admin" className="text-emerald-700 text-sm mb-3 inline-flex items-center gap-1 font-medium">
        <ArrowLeft size={15} />
        Admin
      </Link>
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle size={20} className="text-red-600" />
        <h1 className="text-xl font-bold text-gray-900">Incident Reports</h1>
      </div>
      <p className="text-sm text-gray-500 mb-4">{reports.length} report{reports.length !== 1 ? 's' : ''} submitted</p>

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="search"
          placeholder="Search by name, type, location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}
      {!loading && filtered.length === 0 && (
        <div className="text-center text-gray-400 text-sm bg-white border border-gray-100 rounded-xl p-8">
          {search ? 'No matching reports.' : 'No incident reports submitted yet.'}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((report) => {
          const d = report.data
          const isOpen = expanded === report.id
          const typeColor = TYPE_COLORS[d.incident_type] ?? 'bg-gray-100 text-gray-600'

          return (
            <div key={report.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <button
                className="w-full p-4 flex items-start gap-3 text-left"
                onClick={() => setExpanded(isOpen ? null : report.id)}
              >
                <div className="bg-red-50 text-red-600 rounded-full p-2 shrink-0 mt-0.5">
                  <AlertTriangle size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-800 text-sm">{d.reporter_name ?? 'Unknown'}</p>
                    {d.incident_type && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColor}`}>
                        {d.incident_type}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {d.incident_date} {d.incident_time && `at ${d.incident_time}`}
                    {d.location && ` · ${d.location}`}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                  </p>
                </div>
                {isOpen ? <ChevronUp size={16} className="text-gray-400 shrink-0 mt-1" /> : <ChevronDown size={16} className="text-gray-400 shrink-0 mt-1" />}
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 px-4 pb-4">
                  <div className="mt-3 space-y-0">
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

                  <div className="flex gap-2 mt-4">
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
