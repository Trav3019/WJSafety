import { useAuth } from '../context/AuthContext'

export default function PendingApproval() {
  const { profile, signOut } = useAuth()
  const rejected = profile?.status === 'rejected'

  return (
    <div className="min-h-full flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-6 text-center">
        <h1 className="text-xl font-bold text-emerald-800 mb-2">
          {rejected ? 'Access denied' : 'Awaiting approval'}
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          {rejected
            ? 'Your account request was not approved. Contact your safety officer if you believe this is a mistake.'
            : 'Your account has been created and is waiting for an admin to approve access. Check back soon.'}
        </p>
        <button
          onClick={signOut}
          className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-md px-4 py-2 font-medium"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
