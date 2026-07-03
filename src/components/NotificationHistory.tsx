import { useEffect, useState } from 'react'
import { X, Bell, BellOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatDistanceToNow } from 'date-fns'

interface NotifLog {
  id: string
  title: string
  body: string | null
  created_at: string
}

interface Props {
  onClose: () => void
}

export default function NotificationHistory({ onClose }: Props) {
  const { profile } = useAuth()
  const [logs, setLogs] = useState<NotifLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    supabase
      .from('notification_log')
      .select('id, title, body, created_at')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setLogs((data as NotifLog[]) ?? [])
        setLoading(false)
      })
  }, [profile?.id])

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-white z-50 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-emerald-700" />
            <h2 className="font-semibold text-gray-900">Notification History</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <p className="text-gray-400 text-sm text-center py-10">Loading…</p>
          )}
          {!loading && logs.length === 0 && (
            <div className="flex flex-col items-center gap-3 text-gray-400 py-16 px-6 text-center">
              <BellOff size={32} className="opacity-40" />
              <p className="text-sm">No notifications yet. They'll appear here once you start receiving them.</p>
            </div>
          )}
          {logs.map((log) => (
            <div key={log.id} className="px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 transition-colors">
              <p className="text-sm font-medium text-gray-800">{log.title}</p>
              {log.body && <p className="text-sm text-gray-500 mt-0.5">{log.body}</p>}
              <p className="text-xs text-gray-400 mt-1">
                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
