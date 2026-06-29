import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import type { NewsPost } from '../../lib/types'

export default function AdminNews() {
  const { profile } = useAuth()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)
  const [posts, setPosts] = useState<NewsPost[]>([])

  async function loadPosts() {
    const { data } = await supabase
      .from('news_posts')
      .select('*')
      .order('created_at', { ascending: false })
    setPosts(data ?? [])
  }

  useEffect(() => {
    loadPosts()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('news_posts').insert({
      title,
      body,
      pinned,
      posted_by: profile?.id,
    })
    setSaving(false)
    setTitle('')
    setBody('')
    setPinned(false)
    loadPosts()
  }

  async function removePost(id: string) {
    if (!confirm('Delete this post?')) return
    await supabase.from('news_posts').delete().eq('id', id)
    loadPosts()
  }

  return (
    <div>
      <Link to="/admin" className="text-emerald-700 text-sm mb-3 inline-block">
        ← Admin
      </Link>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Post Safety Update</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-lg shadow-sm p-4 space-y-3 mb-6">
        <input
          required
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2"
        />
        <textarea
          required
          placeholder="What's the update?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 rounded-md px-3 py-2"
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          Pin to top
        </label>
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-md py-2 font-medium"
        >
          {saving ? 'Posting…' : 'Post update'}
        </button>
      </form>

      <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Existing posts</h2>
      <div className="space-y-2">
        {posts.map((p) => (
          <div key={p.id} className="bg-white border border-gray-100 rounded-lg shadow-sm p-3 flex items-center justify-between">
            <p className="font-medium text-gray-800 text-sm">{p.title}</p>
            <button onClick={() => removePost(p.id)} className="text-xs text-red-600">
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
