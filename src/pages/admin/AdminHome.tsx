import { Link } from 'react-router-dom'
import { Users, UploadCloud, ClipboardList, Megaphone, ChevronRight, FileSignature, FolderOpen, type LucideIcon } from 'lucide-react'

const links: { to: string; label: string; desc: string; icon: LucideIcon }[] = [
  { to: '/admin/users', label: 'Manage Users', desc: 'Approve new accounts and set roles', icon: Users },
  { to: '/admin/documents', label: 'Upload Documents', desc: 'Add SDS, plans, inventories and more', icon: UploadCloud },
  { to: '/admin/forms', label: 'Forms', desc: 'Create forms and send them out for signature', icon: ClipboardList },
  { to: '/admin/sign-requests', label: 'PDF Sign Requests', desc: 'Upload a PDF and send it to workers to sign', icon: FileSignature },
  { to: '/admin/worker-files', label: 'Worker Files', desc: 'View completed documents per employee', icon: FolderOpen },
  { to: '/admin/news', label: 'Post Safety Update', desc: 'Share news on the home feed', icon: Megaphone },
]

export default function AdminHome() {
  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Admin</h1>
      <p className="text-sm text-gray-500 mb-4">Manage users, documents, forms, and safety news.</p>
      <div className="space-y-2">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 flex items-center gap-3 hover:border-emerald-300 hover:shadow-md transition-all"
          >
            <div className="bg-emerald-50 text-emerald-700 rounded-full p-2.5 shrink-0">
              <l.icon size={20} />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-800">{l.label}</p>
              <p className="text-sm text-gray-500">{l.desc}</p>
            </div>
            <ChevronRight size={18} className="text-gray-300 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
