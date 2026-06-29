import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Category } from '../lib/types'

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
      <h1 className="text-xl font-bold text-gray-900 mb-4">Document Library</h1>
      {loading && <p className="text-gray-500">Loading…</p>}
      <div className="grid grid-cols-2 gap-3">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            to={`/documents/${cat.id}`}
            state={{ name: cat.name }}
            className="bg-white border border-gray-100 rounded-lg shadow-sm p-4 text-center font-medium text-gray-800 hover:border-emerald-300 hover:shadow"
          >
            {cat.name}
          </Link>
        ))}
      </div>
    </div>
  )
}
