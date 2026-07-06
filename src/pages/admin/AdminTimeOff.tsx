import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Check, X, UserRound } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

interface TimeOffRequest {
  id: string
  user_id: string
  start_date: string
  end_date: string
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  profiles?: { full_name: string; role: string } | null
}

const statusStyle = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
}

// ── Mini calendar ──────────────────────────────────────────────────────────────

function Calendar({ requests }: { requests: TimeOffRequest[] }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const monthName = new Date(year, month).toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' })

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // Sun=0 → Mon first: shift
  const startPad = (firstDay + 6) % 7

  function prev() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function next() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  // Build set of days with approved / pending requests
  const approved = new Set<number>()
  const pending = new Set<number>()

  for (const r of requests) {
    const start = new Date(r.start_date + 'T00:00:00')
    const end = new Date(r.end_date + 'T00:00:00')
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate()
        if (r.status === 'approved') approved.add(day)
        else if (r.status === 'pending') pending.add(day)
      }
    }
  }

  const cells: (number | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // pad to full rows
  while (cells.length % 7 !== 0) cells.push(null)

  const todayDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : null

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prev} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft size={18} />
        </button>
        <span className="font-semibold text-gray-800 text-sm">{monthName}</span>
        <button onClick={next} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} className="text-xs font-semibold text-gray-400 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const isToday = day === todayDay
          const isApproved = approved.has(day)
          const isPending = pending.has(day)
          return (
            <div
              key={i}
              className={`rounded-lg py-1.5 text-xs font-medium relative ${
                isApproved
                  ? 'bg-emerald-100 text-emerald-800'
                  : isPending
                    ? 'bg-amber-100 text-amber-800'
                    : isToday
                      ? 'bg-gray-100 text-gray-800'
                      : 'text-gray-700'
              }`}
            >
              {day}
              {isToday && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-600 rounded-full" />}
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 inline-block" />Approved</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 inline-block" />Pending</span>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function AdminTimeOff() {
  const { profile } = useAuth()
  const [requests, setRequests] = useState<TimeOffRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'pending' | 'all'>('pending')

  async function load() {
    const { data: reqs } = await supabase
      .from('time_off_requests')
      .select('*')
      .order('start_date', { ascending: true })

    const { data: profiles } = await supabase.from('profiles').select('id, full_name, role')
    const profileMap: Record<string, { full_name: string; role: string }> = {}
    for (const p of profiles ?? []) profileMap[p.id] = { full_name: p.full_name, role: p.role }

    const enriched = ((reqs ?? []) as TimeOffRequest[]).map((r) => ({
      ...r,
      profiles: profileMap[r.user_id] ?? null,
    }))
    setRequests(enriched)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function setStatus(id: string, status: 'approved' | 'rejected') {
    await supabase.from('time_off_requests').update({
      status,
      reviewed_by: profile?.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    setRequests((r) => r.map((x) => x.id === id ? { ...x, status } : x))
  }

  const displayed = tab === 'pending' ? requests.filter((r) => r.status === 'pending') : requests
  const pendingCount = requests.filter((r) => r.status === 'pending').length

  return (
    <div>
      <Link to="/admin" className="text-emerald-700 text-sm mb-3 inline-flex items-center gap-1 font-medium">
        <ArrowLeft size={15} />
        Admin
      </Link>
      <div className="flex items-center gap-2 mb-1">
        <CalendarDays size={20} className="text-emerald-700" />
        <h1 className="text-xl font-bold text-gray-900">Time Off Requests</h1>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {pendingCount > 0 ? `${pendingCount} pending request${pendingCount !== 1 ? 's' : ''}` : 'No pending requests'}
      </p>

      <Calendar requests={requests} />

      <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-4">
        <button
          onClick={() => setTab('pending')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'pending' ? 'bg-emerald-700 text-white' : 'bg-white text-gray-600'}`}
        >
          Pending {pendingCount > 0 && `(${pendingCount})`}
        </button>
        <button
          onClick={() => setTab('all')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'all' ? 'bg-emerald-700 text-white' : 'bg-white text-gray-600'}`}
        >
          All Requests
        </button>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      {!loading && displayed.length === 0 && (
        <div className="text-center text-gray-400 text-sm bg-white border border-gray-100 rounded-xl p-8">
          {tab === 'pending' ? 'No pending requests.' : 'No requests submitted yet.'}
        </div>
      )}

      <div className="space-y-2">
        {displayed.map((r) => (
          <div key={r.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-3.5">
            <div className="flex items-start gap-3">
              <div className="bg-emerald-50 text-emerald-700 rounded-full p-2 shrink-0">
                <UserRound size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm">{r.profiles?.full_name ?? 'Unknown'}</p>
                <p className="text-xs text-gray-500 capitalize">{r.profiles?.role}</p>
                <p className="text-sm text-gray-700 mt-1 font-medium">
                  {fmt(r.start_date)}{r.end_date !== r.start_date ? ` → ${fmt(r.end_date)}` : ''}
                </p>
                {r.reason && <p className="text-xs text-gray-500 mt-0.5">{r.reason}</p>}
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 capitalize ${statusStyle[r.status]}`}>
                {r.status}
              </span>
            </div>

            {r.status === 'pending' && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setStatus(r.id, 'approved')}
                  className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2.5 py-1.5 font-medium transition-colors"
                >
                  <Check size={13} />
                  Approve
                </button>
                <button
                  onClick={() => setStatus(r.id, 'rejected')}
                  className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg px-2.5 py-1.5 font-medium transition-colors"
                >
                  <X size={13} />
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
