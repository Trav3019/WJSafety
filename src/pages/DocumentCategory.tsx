import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { SafetyDocument } from '../lib/types'
import { cacheFile, getCachedFile, isCached } from '../lib/offlineDb'

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(0)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

export default function DocumentCategory() {
  const { categoryId } = useParams()
  const location = useLocation()
  const categoryName = (location.state as { name?: string } | null)?.name ?? 'Documents'
  const [docs, setDocs] = useState<SafetyDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [cachedMap, setCachedMap] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!categoryId) return
    supabase
      .from('documents')
      .select('*')
      .eq('category_id', categoryId)
      .order('created_at', { ascending: false })
      .then(async ({ data }) => {
        const list = data ?? []
        setDocs(list)
        const map: Record<string, boolean> = {}
        for (const doc of list) {
          map[doc.id] = await isCached(doc.storage_path)
        }
        setCachedMap(map)
        setLoading(false)
      })
  }, [categoryId])

  async function openDoc(doc: SafetyDocument) {
    setBusy(doc.id)
    try {
      const cached = await getCachedFile(doc.storage_path)
      let blob = cached
      if (!blob) {
        const { data, error } = await supabase.storage.from('documents').download(doc.storage_path)
        if (error || !data) {
          alert('Could not load this document. You may be offline and it has not been cached yet.')
          return
        }
        blob = data
        await cacheFile(doc.storage_path, blob)
        setCachedMap((m) => ({ ...m, [doc.id]: true }))
      }
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } finally {
      setBusy(null)
    }
  }

  async function downloadForOffline(doc: SafetyDocument, e: React.MouseEvent) {
    e.stopPropagation()
    setBusy(doc.id)
    try {
      const { data, error } = await supabase.storage.from('documents').download(doc.storage_path)
      if (error || !data) {
        alert('Could not download this document while offline.')
        return
      }
      await cacheFile(doc.storage_path, data)
      setCachedMap((m) => ({ ...m, [doc.id]: true }))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <Link to="/documents" className="text-emerald-700 text-sm mb-3 inline-block">
        ← All categories
      </Link>
      <h1 className="text-xl font-bold text-gray-900 mb-4">{categoryName}</h1>
      {loading && <p className="text-gray-500">Loading…</p>}
      {!loading && docs.length === 0 && <p className="text-gray-500">No documents in this category yet.</p>}
      <div className="space-y-2">
        {docs.map((doc) => (
          <div
            key={doc.id}
            onClick={() => openDoc(doc)}
            className="bg-white border border-gray-100 rounded-lg shadow-sm p-3 flex items-center justify-between cursor-pointer hover:border-emerald-300"
          >
            <div>
              <p className="font-medium text-gray-800">{doc.title}</p>
              {doc.description && <p className="text-xs text-gray-500">{doc.description}</p>}
              <p className="text-xs text-gray-400 mt-0.5">{formatSize(doc.file_size_bytes)}</p>
            </div>
            <button
              onClick={(e) => downloadForOffline(doc, e)}
              disabled={busy === doc.id}
              className={`text-xs px-2.5 py-1.5 rounded-md shrink-0 ${
                cachedMap[doc.id]
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {busy === doc.id ? '…' : cachedMap[doc.id] ? 'Saved offline' : 'Save offline'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
