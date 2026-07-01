import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, FolderOpen, CloudCheck, CloudDownload } from 'lucide-react'
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
      const a = document.createElement('a')
      a.href = url
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 10000)
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
      <Link to="/documents" className="text-emerald-700 text-sm mb-3 inline-flex items-center gap-1 font-medium">
        <ArrowLeft size={15} />
        All categories
      </Link>
      <h1 className="text-xl font-bold text-gray-900 mb-4">{categoryName}</h1>
      {loading && <p className="text-gray-500">Loading…</p>}
      {!loading && docs.length === 0 && (
        <div className="flex flex-col items-center gap-2 text-gray-400 text-sm bg-white border border-gray-100 rounded-xl p-8 text-center">
          <FolderOpen size={28} className="opacity-50" />
          No documents in this category yet.
        </div>
      )}
      <div className="space-y-2">
        {docs.map((doc) => (
          <div
            key={doc.id}
            onClick={() => openDoc(doc)}
            className="bg-white border border-gray-100 rounded-xl shadow-sm p-3.5 flex items-center gap-3 cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all"
          >
            <div className="bg-emerald-50 text-emerald-700 rounded-full p-2.5 shrink-0">
              <FileText size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 truncate">{doc.title}</p>
              {doc.description && <p className="text-xs text-gray-500 truncate">{doc.description}</p>}
              <p className="text-xs text-gray-400 mt-0.5">{formatSize(doc.file_size_bytes)}</p>
            </div>
            <div className="shrink-0">
              {busy === doc.id ? (
                <span className="text-xs text-gray-400">…</span>
              ) : cachedMap[doc.id] ? (
                <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                  <CloudCheck size={14} />
                  Offline
                </span>
              ) : (
                <button
                  onClick={(e) => downloadForOffline(doc, e)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-600 transition-colors"
                  title="Save for offline"
                >
                  <CloudDownload size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
