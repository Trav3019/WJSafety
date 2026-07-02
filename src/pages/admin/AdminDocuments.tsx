import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FileText, Trash2, Upload, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import type { Category, SafetyDocument } from '../../lib/types'

export default function AdminDocuments() {
  const { profile } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<Record<string, 'pending' | 'done' | 'error'>>({})
  const [error, setError] = useState<string | null>(null)
  const [docs, setDocs] = useState<SafetyDocument[]>([])

  async function loadDocs() {
    const { data } = await supabase.from('documents').select('*').order('created_at', { ascending: false }).limit(30)
    setDocs(data ?? [])
  }

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .order('sort_order')
      .then(({ data }) => {
        setCategories(data ?? [])
        if (data && data.length) setCategoryId(data[0].id)
      })
    loadDocs()
  }, [])

  function pickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(e.target.files ?? []))
    setProgress({})
    setError(null)
  }

  function removeFile(name: string) {
    setFiles((f) => f.filter((x) => x.name !== name))
    setProgress((p) => { const next = { ...p }; delete next[name]; return next })
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!files.length || !categoryId) return
    setUploading(true)
    setError(null)

    const initial: Record<string, 'pending' | 'done' | 'error'> = {}
    files.forEach((f) => (initial[f.name] = 'pending'))
    setProgress(initial)

    await Promise.all(
      files.map(async (file) => {
        const path = `${categoryId}/${Date.now()}-${file.name}`
        const { error: uploadError } = await supabase.storage.from('documents').upload(path, file)
        if (uploadError) {
          setProgress((p) => ({ ...p, [file.name]: 'error' }))
          return
        }
        const { error: insertError } = await supabase.from('documents').insert({
          category_id: categoryId,
          title: file.name.replace(/\.[^.]+$/, ''), // strip extension for title
          storage_path: path,
          file_type: file.type,
          file_size_bytes: file.size,
          uploaded_by: profile?.id,
        })
        setProgress((p) => ({ ...p, [file.name]: insertError ? 'error' : 'done' }))
      })
    )

    setUploading(false)
    setFiles([])
    if (fileRef.current) fileRef.current.value = ''
    loadDocs()
  }

  async function removeDoc(doc: SafetyDocument) {
    if (!confirm(`Delete "${doc.title}"?`)) return
    await supabase.storage.from('documents').remove([doc.storage_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    loadDocs()
  }

  const allDone = files.length > 0 && files.every((f) => progress[f.name] === 'done')
  const hasErrors = files.some((f) => progress[f.name] === 'error')

  return (
    <div>
      <Link to="/admin" className="text-emerald-700 text-sm mb-3 inline-flex items-center gap-1 font-medium">
        <ArrowLeft size={15} />
        Admin
      </Link>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Upload Documents</h1>

      <form onSubmit={handleUpload} className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 space-y-3 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* File drop zone */}
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-5 text-center cursor-pointer hover:border-emerald-400 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={22} className="mx-auto text-gray-400 mb-1" />
          <p className="text-sm text-gray-500">
            {files.length > 0
              ? `${files.length} file${files.length > 1 ? 's' : ''} selected`
              : 'Tap to select files — you can pick multiple at once'}
          </p>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={pickFiles}
          />
        </div>

        {/* File list with status */}
        {files.length > 0 && (
          <ul className="space-y-1.5">
            {files.map((f) => {
              const state = progress[f.name]
              return (
                <li key={f.name} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                  <FileText size={14} className="text-gray-400 shrink-0" />
                  <span className="flex-1 truncate text-gray-700">{f.name}</span>
                  {state === 'pending' && <span className="text-xs text-gray-400">Uploading…</span>}
                  {state === 'done' && <span className="text-xs text-emerald-600 font-medium">Done</span>}
                  {state === 'error' && <span className="text-xs text-red-500 font-medium">Failed</span>}
                  {!state && (
                    <button type="button" onClick={() => removeFile(f.name)} className="text-gray-400 hover:text-gray-600">
                      <X size={14} />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {allDone && !hasErrors && (
          <p className="text-sm text-emerald-600 font-medium">All files uploaded successfully.</p>
        )}
        {hasErrors && (
          <p className="text-sm text-red-500">Some files failed to upload. Check your connection and try again.</p>
        )}
        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={uploading || !files.length}
          className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg py-2.5 font-medium shadow-sm transition-colors"
        >
          {uploading ? `Uploading ${files.length} file${files.length > 1 ? 's' : ''}…` : `Upload${files.length > 1 ? ` ${files.length} files` : ''}`}
        </button>
      </form>

      <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Recently uploaded</h2>
      {docs.length === 0 && <p className="text-gray-400 text-sm">No documents uploaded yet.</p>}
      <div className="space-y-2">
        {docs.map((doc) => (
          <div key={doc.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-3.5 flex items-center gap-3">
            <div className="bg-emerald-50 text-emerald-700 rounded-full p-2 shrink-0">
              <FileText size={16} />
            </div>
            <p className="font-medium text-gray-800 text-sm flex-1 truncate">{doc.title}</p>
            <button
              onClick={() => removeDoc(doc)}
              className="text-red-500 hover:bg-red-50 rounded-lg p-1.5 shrink-0 transition-colors"
              aria-label="Delete"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
