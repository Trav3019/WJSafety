import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getExistingSubscription, pushSupported, subscribeToPush } from '../lib/push'

export default function NotificationPrompt() {
  const { profile } = useAuth()
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!pushSupported() || Notification.permission !== 'default') return
    getExistingSubscription().then((sub) => setVisible(!sub))
  }, [])

  async function enable() {
    if (!profile) return
    setError(null)
    try {
      await subscribeToPush(profile.id)
      setVisible(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enable notifications.')
    }
  }

  if (!visible) return null

  return (
    <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2 flex items-center justify-between gap-3 text-sm">
      <span className="text-emerald-800">Get notified about new safety updates and forms.</span>
      <div className="flex items-center gap-2 shrink-0">
        {error && <span className="text-red-600 text-xs">{error}</span>}
        <button onClick={enable} className="bg-emerald-700 text-white rounded-md px-3 py-1">
          Enable
        </button>
        <button onClick={() => setVisible(false)} className="text-emerald-700">
          Dismiss
        </button>
      </div>
    </div>
  )
}
