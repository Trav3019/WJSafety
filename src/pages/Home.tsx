import { useEffect, useState } from 'react'
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
      <h1 className="text-xl font-bold text-gray-900 mb-4">Safety Updates</h1>
      {loading && <p className="text-gray-500">Loading…</p>}
      {!loading && posts.length === 0 && (
        <p className="text-gray-500">No safety updates yet.</p>
      )}
      <div className="space-y-3">
        {posts.map((post) => (
          <article key={post.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold text-gray-900">{post.title}</h2>
              {post.pinned && (
                <span className="text-xs bg-amber-100 text-amber-800 rounded-full px-2 py-0.5 shrink-0">
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
