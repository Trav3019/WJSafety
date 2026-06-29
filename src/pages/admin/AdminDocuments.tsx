import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import type { Category, SafetyDocument } from '../../lib/types'

export default function AdminDocuments() {
  const { profile } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [docs, setDocs] = useState<SafetyDocument[]>([])

  async function loadDocs() {
    const { data } = await supabase.from('documents').select('*').order('created_at', { ascending: false }).limit(20)
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

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !categoryId) return
    setUploading(true)
    setError(null)

    const path = `${categoryId}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file)
    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    const { error: insertError } = await supabase.from('documents').insert({
      category_id: categoryId,
      title: title || file.name,
      description: description || null,
      storage_path: path,
      file_type: file.type,
      file_size_bytes: file.size,
      uploaded_by: profile?.id,
    })

    setUploading(false)
    if (insertError) {
      setError(insertError.message)
    } else {
      setTitle('')
      setDescription('')
      setFile(null)
      loadDocs()
    }
  }

  async function removeDoc(doc: SafetyDocument) {
    if (!confirm(`Delete "${doc.title}"?`)) return
    await supabase.storage.from('documents').remove([doc.storage_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    loadDocs()
  }

  return (
    <div>
      <Link to="/admin" className="text-emerald-700 text-sm mb-3 inline-block">
        ← Admin
      </Link>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Upload Documents</h1>

      <form onSubmit={handleUpload} className="bg-white border border-gray-100 rounded-lg shadow-sm p-4 space-y-3 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Defaults to file name"
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
          <input
            type="file"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={uploading}
          className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-md py-2 font-medium"
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </form>

      <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Recently uploaded</h2>
      <div className="space-y-2">
        {docs.map((doc) => (
          <div key={doc.id} className="bg-white border border-gray-100 rounded-lg shadow-sm p-3 flex items-center justify-between">
            <p className="font-medium text-gray-800 text-sm">{doc.title}</p>
            <button onClick={() => removeDoc(doc)} className="text-xs text-red-600">
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
