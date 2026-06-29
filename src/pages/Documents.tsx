import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Scale, ShieldAlert, Wrench, FileWarning, FlaskConical, BookOpen, Folder, type LucideIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Category } from '../lib/types'

const iconByCategory: Record<string, LucideIcon> = {
  'Acts and Regulations': Scale,
  'Emergency Response Plan': ShieldAlert,
  'Equipment Inventory': Wrench,
  'Incident Report Forms': FileWarning,
  SDS: FlaskConical,
  'Field Books': BookOpen,
}

export default function Documents() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .order('sort_order')
      .then(({ data }) => {
        setCategories(data ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Document Library</h1>
      <p className="text-sm text-gray-500 mb-4">SDS sheets, plans, and reference documents.</p>
      {loading && <p className="text-gray-500">Loading…</p>}
      <div className="grid grid-cols-2 gap-3">
        {categories.map((cat) => {
          const Icon = iconByCategory[cat.name] ?? Folder
          return (
            <Link
              key={cat.id}
              to={`/documents/${cat.id}`}
              state={{ name: cat.name }}
              className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 flex flex-col items-center gap-2 text-center font-medium text-gray-800 hover:border-emerald-300 hover:shadow-md transition-all"
            >
              <div className="bg-emerald-50 text-emerald-700 rounded-full p-3">
                <Icon size={22} />
              </div>
              <span className="text-sm">{cat.name}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
