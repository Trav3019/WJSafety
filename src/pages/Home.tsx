import { useEffect, useState } from 'react'
import { Pin, Megaphone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { NewsPost } from '../lib/types'
import { formatDistanceToNow } from 'date-fns'

export default function Home() {
  const [posts, setPosts] = useState<NewsPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('news_posts')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPosts(data ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Safety Updates</h1>
      <p className="text-sm text-gray-500 mb-4">News and reminders from the safety team.</p>
      {loading && <p className="text-gray-500">Loading…</p>}
      {!loading && posts.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-gray-400">
          <Megaphone size={28} className="mx-auto mb-2 opacity-50" />
          No safety updates yet.
        </div>
      )}
      <div className="space-y-3">
        {posts.map((post) => (
          <article
            key={post.id}
            className={`bg-white rounded-xl shadow-sm border p-4 ${
              post.pinned ? 'border-amber-200' : 'border-gray-100'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold text-gray-900">{post.title}</h2>
              {post.pinned && (
                <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-800 rounded-full px-2 py-0.5 shrink-0">
                  <Pin size={11} />
                  Pinned
                </span>
              )}
            </div>
            <p className="text-gray-600 text-sm mt-1 whitespace-pre-wrap">{post.body}</p>
            <p className="text-xs text-gray-400 mt-2">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </p>
          </article>
        ))}
      </div>
    </div>
  )
}
