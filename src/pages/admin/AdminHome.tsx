import { Link } from 'react-router-dom'

const links = [
  { to: '/admin/users', label: 'Manage Users', desc: 'Approve new accounts and set roles' },
  { to: '/admin/documents', label: 'Upload Documents', desc: 'Add SDS, plans, inventories and more' },
  { to: '/admin/forms', label: 'Forms', desc: 'Create forms and send them out for signature' },
  { to: '/admin/news', label: 'Post Safety Update', desc: 'Share news on the home feed' },
]

export default function AdminHome() {
  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Admin</h1>
      <div className="space-y-2">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="bg-white border border-gray-100 rounded-lg shadow-sm p-4 block hover:border-emerald-300"
          >
            <p className="font-medium text-gray-800">{l.label}</p>
            <p className="text-sm text-gray-500">{l.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
