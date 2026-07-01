import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Pin, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { NewsPost } from '../../lib/types'

export default function AdminNews() {
  const [posts, setPosts] = useState<NewsPost[]>([])
  const [loading, setLoading] = useState(true)

  async function loadPosts() {
    const { data } = await supabase
      .from('news_posts')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false })
    setPosts((data as unknown as NewsPost[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { loadPosts() }, [])

  async function removePost(post: NewsPost) {
    if (!confirm('Delete this post?')) return
    if (post.image_path) await supabase.storage.from('post-images').remove([post.image_path])
    await supabase.from('news_posts').delete().eq('id', post.id)
    loadPosts()
  }

  async function togglePin(post: NewsPost) {
    await supabase.from('news_posts').update({ pinned: !post.pinned }).eq('id', post.id)
    loadPosts()
  }

  return (
    <div>
      <Link to="/admin" className="text-emerald-700 text-sm mb-3 inline-flex items-center gap-1 font-medium">
        <ArrowLeft size={15} />
        Admin
      </Link>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Manage Posts</h1>
      <p className="text-sm text-gray-500 mb-4">Pin or delete posts from the Safety Feed.</p>

      {loading && <p className="text-gray-400 text-sm">Loading…</p>}
      {!loading && posts.length === 0 && <p className="text-gray-400 text-sm">No posts yet.</p>}
      <div className="space-y-2">
        {posts.map((p) => (
          <div key={p.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-3.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 text-sm truncate">
                {p.body?.slice(0, 60) || '(image only)'}
              </p>
              <p className="text-xs text-gray-400">{p.profiles?.full_name ?? 'Unknown'}</p>
            </div>
            {p.pinned && (
              <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 shrink-0">Pinned</span>
            )}
            <button
              onClick={() => togglePin(p)}
              title={p.pinned ? 'Unpin' : 'Pin to top'}
              className="p-1.5 text-gray-400 hover:text-amber-500 rounded-lg transition-colors shrink-0"
            >
              <Pin size={15} />
            </button>
            <button
              onClick={() => removePost(p)}
              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors shrink-0"
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
