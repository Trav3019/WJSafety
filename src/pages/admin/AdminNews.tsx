import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Megaphone, Pin, Trash2 } from 'lucide-react'
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
      <Link to="/admin" className="text-emerald-700 text-sm mb-3 inline-flex items-center gap-1 font-medium">
        <ArrowLeft size={15} />
        Admin
      </Link>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Post Safety Update</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 space-y-3 mb-6">
        <input
          required
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
        />
        <textarea
          required
          placeholder="What's the update?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          Pin to top
        </label>
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg py-2.5 font-medium shadow-sm transition-colors"
        >
          {saving ? 'Posting…' : 'Post update'}
        </button>
      </form>

      <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Existing posts</h2>
      {posts.length === 0 && <p className="text-gray-400 text-sm">No posts yet.</p>}
      <div className="space-y-2">
        {posts.map((p) => (
          <div key={p.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-3.5 flex items-center gap-3">
            <div className="bg-emerald-50 text-emerald-700 rounded-full p-2 shrink-0">
              {p.pinned ? <Pin size={16} /> : <Megaphone size={16} />}
            </div>
            <p className="font-medium text-gray-800 text-sm flex-1 truncate">{p.title}</p>
            <button
              onClick={() => removePost(p.id)}
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
