import { Hourglass, ShieldX } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function PendingApproval() {
  const { profile, signOut } = useAuth()
  const rejected = profile?.status === 'rejected'

  return (
    <div className="min-h-full flex items-center justify-center px-4 bg-gradient-to-b from-emerald-800 to-emerald-950">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-7 text-center">
        <div
          className={`mx-auto mb-4 rounded-full p-3 w-fit ${
            rejected ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
          }`}
        >
          {rejected ? <ShieldX size={26} /> : <Hourglass size={26} />}
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          {rejected ? 'Access denied' : 'Awaiting approval'}
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          {rejected
            ? 'Your account request was not approved. Contact your safety officer if you believe this is a mistake.'
            : 'Your account has been created and is waiting for an admin to approve access. Check back soon.'}
        </p>
        <button
          onClick={signOut}
          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg py-2.5 font-medium shadow-sm transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
