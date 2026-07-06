import { useEffect, useState } from 'react'
import { CalendarDays, Plus, X, Check, Clock, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

interface TimeOffRequest {
  id: string
  start_date: string
  end_date: string
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

const statusStyle = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}

const statusIcon = {
  pending: Clock,
  approved: Check,
  rejected: X,
}

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TimeOff() {
  const { profile } = useAuth()
  const [requests, setRequests] = useState<TimeOffRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ start_date: '', end_date: '', reason: '' })

  async function load() {
    if (!profile) return
    const { data } = await supabase
      .from('time_off_requests')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
    setRequests((data as TimeOffRequest[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [profile?.id])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile || !form.start_date || !form.end_date) return
    if (form.end_date < form.start_date) {
      alert('End date must be on or after start date.')
      return
    }
    setSubmitting(true)
    await supabase.from('time_off_requests').insert({
      user_id: profile.id,
      start_date: form.start_date,
      end_date: form.end_date,
      reason: form.reason || null,
    })
    setForm({ start_date: '', end_date: '', reason: '' })
    setShowForm(false)
    setSubmitting(false)
    load()
  }

  async function cancel(id: string) {
    if (!confirm('Cancel this request?')) return
    await supabase.from('time_off_requests').delete().eq('id', id)
    setRequests((r) => r.filter((x) => x.id !== id))
  }

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white'

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <CalendarDays size={20} className="text-emerald-700" />
          <h1 className="text-xl font-bold text-gray-900">Time Off</h1>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium bg-emerald-700 text-white px-3 py-1.5 rounded-lg"
        >
          <Plus size={15} />
          Request
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">Submit and track your time off requests.</p>

      {showForm && (
        <form onSubmit={submit} className="bg-white border border-emerald-100 rounded-2xl shadow-sm p-4 mb-4 space-y-3">
          <h2 className="font-semibold text-gray-700 text-sm">New Request</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date *</label>
              <input
                type="date"
                required
                className={inputCls}
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date *</label>
              <input
                type="date"
                required
                className={inputCls}
                value={form.end_date}
                min={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Reason (optional)</label>
            <textarea
              rows={2}
              className={inputCls + ' resize-none'}
              placeholder="e.g. Family holiday, medical appointment…"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-emerald-700 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-gray-500 bg-gray-100 rounded-xl"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      {!loading && requests.length === 0 && (
        <div className="text-center text-gray-400 text-sm bg-white border border-gray-100 rounded-xl p-8">
          No time off requests yet. Tap "Request" to submit one.
        </div>
      )}

      <div className="space-y-2">
        {requests.map((r) => {
          const Icon = statusIcon[r.status]
          return (
            <div key={r.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-3.5 flex items-start gap-3">
              <div className={`rounded-full p-2 shrink-0 mt-0.5 ${statusStyle[r.status]}`}>
                <Icon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm">
                  {fmt(r.start_date)}
                  {r.end_date !== r.start_date && ` → ${fmt(r.end_date)}`}
                </p>
                {r.reason && <p className="text-xs text-gray-500 mt-0.5 truncate">{r.reason}</p>}
                <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusStyle[r.status]}`}>
                  {r.status}
                </span>
              </div>
              {r.status === 'pending' && (
                <button
                  onClick={() => cancel(r.id)}
                  className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
