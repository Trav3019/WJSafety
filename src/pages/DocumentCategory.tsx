import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, FolderOpen, CloudCheck, CloudDownload, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { SafetyDocument } from '../lib/types'
import { cacheFile, getCachedFile, isCached } from '../lib/offlineDb'
import PdfViewer from '../components/PdfViewer'
import ExcelViewer from '../components/ExcelViewer'
import WordViewer from '../components/WordViewer'

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
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(!localStorage.getItem(`wjs_docs_${categoryId ?? ''}`))
  const [cachedMap, setCachedMap] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [viewer, setViewer] = useState<{ url: string; title: string } | null>(null)
  const [excelViewer, setExcelViewer] = useState<{ blob: Blob; title: string } | null>(null)
  const [wordViewer, setWordViewer] = useState<{ blob: Blob; title: string } | null>(null)

  useEffect(() => {
    if (!categoryId) return

    // Load cached doc list immediately so the page works offline
    const cacheKey = `wjs_docs_${categoryId}`
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      try {
        const list: SafetyDocument[] = JSON.parse(cached)
        setDocs(list)
        // Populate cached map from IndexedDB
        Promise.all(list.map(async (doc) => [doc.id, await isCached(doc.storage_path)] as const))
          .then((entries) => setCachedMap(Object.fromEntries(entries)))
      } catch { /* ignore */ }
    }

    supabase
      .from('documents')
      .select('*')
      .eq('category_id', categoryId)
      .order('created_at', { ascending: false })
      .then(async ({ data, error }) => {
        const list = (!error && data) ? data : []
        if (list.length > 0) {
          setDocs(list)
          localStorage.setItem(cacheKey, JSON.stringify(list))
        }
        const map: Record<string, boolean> = {}
        for (const doc of list) {
          map[doc.id] = await isCached(doc.storage_path)
        }
        if (list.length > 0) setCachedMap(map)
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
      const ext = doc.storage_path.split('.').pop()?.toLowerCase() ?? ''
      const isExcel = ['xlsx', 'xls', 'xlsm', 'xlsb', 'ods'].includes(ext)
      const isWord = ['docx', 'doc'].includes(ext)
      if (isExcel) {
        setExcelViewer({ blob, title: doc.title || 'Document' })
      } else if (isWord) {
        setWordViewer({ blob, title: doc.title || 'Document' })
      } else {
        const url = URL.createObjectURL(blob)
        setViewer({ url, title: doc.title || 'Document' })
      }
    } finally {
      setBusy(null)
    }
  }

  function closeViewer() {
    if (viewer) URL.revokeObjectURL(viewer.url)
    setViewer(null)
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
    <>
      {viewer && <PdfViewer url={viewer.url} title={viewer.title} onClose={closeViewer} />}
      {excelViewer && (
        <ExcelViewer blob={excelViewer.blob} title={excelViewer.title} onClose={() => setExcelViewer(null)} />
      )}
      {wordViewer && (
        <WordViewer blob={wordViewer.blob} title={wordViewer.title} onClose={() => setWordViewer(null)} />
      )}
      <div>
        <Link to="/documents" className="text-emerald-700 text-sm mb-3 inline-flex items-center gap-1 font-medium">
          <ArrowLeft size={15} />
          All categories
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mb-4">{categoryName}</h1>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search documents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {loading && <p className="text-gray-500">Loading…</p>}
        {!loading && docs.length === 0 && (
          <div className="flex flex-col items-center gap-2 text-gray-400 text-sm bg-white border border-gray-100 rounded-xl p-8 text-center">
            <FolderOpen size={28} className="opacity-50" />
            No documents in this category yet.
          </div>
        )}
        <div className="space-y-2">
          {docs.filter((doc) => {
            if (!search.trim()) return true
            const q = search.toLowerCase()
            return doc.title?.toLowerCase().includes(q) || doc.description?.toLowerCase().includes(q)
          }).map((doc) => (
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
    </>
  )
}
