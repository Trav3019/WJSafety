import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarDays, ChevronRight, type LucideIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const links: { to: string; label: string; desc: string; icon: LucideIcon; red?: boolean; amber?: boolean }[] = [
  { to: '/manager/incidents', label: 'Incident Reports', desc: 'View and review incident reports from workers', icon: AlertTriangle, red: true },
  { to: '/manager/time-off', label: 'Time Off Requests', desc: 'Approve or reject requests and view the calendar', icon: CalendarDays, amber: true },
]

export default function ManagerHome() {
  const [incidentCount, setIncidentCount] = useState(0)
  const [timeOffCount, setTimeOffCount] = useState(0)

  useEffect(() => {
    supabase
      .from('incident_reports')
      .select('id', { count: 'exact', head: true })
      .is('reviewed_at', null)
      .then(({ count }) => setIncidentCount(count ?? 0))
    supabase
      .from('time_off_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .then(({ count }) => setTimeOffCount(count ?? 0))
  }, [])

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Manager</h1>
      <p className="text-sm text-gray-500 mb-4">Review incident reports and manage time off.</p>

      {incidentCount > 0 && (
        <Link
          to="/manager/incidents"
          className="flex items-center gap-3 bg-red-600 text-white rounded-xl p-4 mb-4 shadow-md animate-pulse"
        >
          <AlertTriangle size={22} className="shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-sm">
              {incidentCount} Unreviewed Incident Report{incidentCount !== 1 ? 's' : ''}
            </p>
            <p className="text-red-100 text-xs">Tap to view and review</p>
          </div>
          <ChevronRight size={18} className="shrink-0 text-red-200" />
        </Link>
      )}

      <div className="space-y-2">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 flex items-center gap-3 hover:border-emerald-300 hover:shadow-md transition-all"
          >
            <div className={`${l.red ? 'bg-red-50 text-red-600' : l.amber ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'} rounded-full p-2.5 shrink-0`}>
              <l.icon size={20} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-800">{l.label}</p>
                {l.red && incidentCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                    {incidentCount}
                  </span>
                )}
                {l.amber && timeOffCount > 0 && (
                  <span className="bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                    {timeOffCount}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">{l.desc}</p>
            </div>
            <ChevronRight size={18} className="text-gray-300 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
