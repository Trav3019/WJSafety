import { useEffect, useRef, useState, useCallback } from 'react'
import { Pin, ImagePlus, Send, Trash2, X, MessageCircle, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { logNotif } from '../lib/notifLog'
import type { NewsPost, PostComment } from '../lib/types'
import { formatDistanceToNow } from 'date-fns'

function Avatar({ name, small }: { name: string; small?: boolean }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500', 'bg-teal-500']
  const color = colors[name.charCodeAt(0) % colors.length]
  const size = small ? 'w-7 h-7 text-xs' : 'w-10 h-10 text-sm'
  return (
    <div className={`${color} ${size} text-white rounded-full flex items-center justify-center font-semibold shrink-0`}>
      {initials}
    </div>
  )
}

function CommentSection({ postId, postedBy, initialCount }: { postId: string; postedBy: string; initialCount: number }) {
  const { profile, isAdmin } = useAuth()
  const [comments, setComments] = useState<PostComment[]>([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [open, setOpen] = useState(false)

  async function loadComments() {
    const { data } = await supabase
      .from('post_comments')
      .select('*, profiles(full_name)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
    setComments((data as unknown as PostComment[]) ?? [])
  }

  useEffect(() => {
    if (open) loadComments()
  }, [open])

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    await supabase.from('post_comments').insert({
      post_id: postId,
      commented_by: profile?.id,
      body: body.trim(),
    })
    // Notify the post author if it's not the commenter themselves
    if (postedBy && postedBy !== profile?.id) {
      const commenter = profile?.full_name ?? 'Someone'
      supabase.functions.invoke('Send-Push', {
        body: { type: 'comment_posted', user_id: postedBy, commenter_name: commenter, post_id: postId },
      })
      logNotif(postedBy, `${commenter} commented on your post`, body.trim())
    }
    setBody('')
    setSending(false)
    loadComments()
  }

  async function deleteComment(id: string) {
    await supabase.from('post_comments').delete().eq('id', id)
    loadComments()
  }

  return (
    <div className="border-t border-gray-100">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-emerald-700 px-4 py-2.5 transition-colors w-full"
      >
        <MessageCircle size={14} />
        {open
          ? 'Hide comments'
          : (open ? comments.length : initialCount) > 0
            ? `${open ? comments.length : initialCount} comment${(open ? comments.length : initialCount) !== 1 ? 's' : ''}`
            : 'Comments'}
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-3">
          {comments.length === 0 && (
            <p className="text-xs text-gray-400">No comments yet — be the first!</p>
          )}
          {comments.map((c) => {
            const name = c.profiles?.full_name ?? 'Unknown'
            const canDelete = isAdmin || c.commented_by === profile?.id
            return (
              <div key={c.id} className="flex gap-2">
                <Avatar name={name} small />
                <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-xs font-semibold text-gray-800">{name}</span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-700 mt-0.5 whitespace-pre-wrap">{c.body}</p>
                </div>
                {canDelete && (
                  <button
                    onClick={() => deleteComment(c.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors self-start mt-1"
                    aria-label="Delete comment"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )
          })}

          <form onSubmit={submitComment} className="flex gap-2 pt-1">
            {profile && <Avatar name={profile.full_name} small />}
            <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-full px-3 py-1.5">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write a comment…"
                className="flex-1 text-xs bg-transparent focus:outline-none text-gray-800 placeholder-gray-400"
              />
              <button
                type="submit"
                disabled={sending || !body.trim()}
                className="text-emerald-600 disabled:opacity-30 transition-opacity"
                aria-label="Send comment"
              >
                <Send size={13} />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default function Home() {
  const { profile, isAdmin } = useAuth()
  const [posts, setPosts] = useState<NewsPost[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [body, setBody] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const pullStartY = useRef(0)
  const pullDelta = useRef(0)
  const [pullDistance, setPullDistance] = useState(0)

  async function loadPosts() {
    const { data } = await supabase
      .from('news_posts')
      .select('*, profiles(full_name), post_comments(id)')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
    setPosts((data as unknown as NewsPost[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { loadPosts() }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY === 0) pullStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (pullStartY.current === 0) return
    const delta = e.touches[0].clientY - pullStartY.current
    if (delta > 0 && window.scrollY === 0) {
      pullDelta.current = Math.min(delta, 80)
      setPullDistance(pullDelta.current)
    }
  }, [])

  const handleTouchEnd = useCallback(async () => {
    if (pullDelta.current > 60) {
      setRefreshing(true)
      await loadPosts()
      setRefreshing(false)
    }
    pullStartY.current = 0
    pullDelta.current = 0
    setPullDistance(0)
  }, [])

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setImage(file)
    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

  function clearImage() {
    setImage(null)
    setImagePreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim() && !image) return
    setPosting(true)

    let image_path: string | null = null
    if (image && profile) {
      const ext = image.name.split('.').pop()
      const path = `${profile.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('post-images').upload(path, image)
      if (!error) image_path = path
    }

    await supabase.from('news_posts').insert({
      body: body.trim(),
      image_path,
      posted_by: profile?.id,
      pinned: false,
    })

    setBody('')
    clearImage()
    setPosting(false)
    loadPosts()
  }

  async function deletePost(post: NewsPost) {
    if (!confirm('Delete this post?')) return
    if (post.image_path) await supabase.storage.from('post-images').remove([post.image_path])
    await supabase.from('news_posts').delete().eq('id', post.id)
    loadPosts()
  }

  async function togglePin(post: NewsPost) {
    await supabase.from('news_posts').update({ pinned: !post.pinned }).eq('id', post.id)
    loadPosts()
  }

  const getImageUrl = (path: string) =>
    supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl

  return (
    <div
      className="max-w-xl mx-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{ height: pullDistance > 0 ? pullDistance : refreshing ? 48 : 0 }}
      >
        <RefreshCw
          size={20}
          className={`text-emerald-600 ${refreshing ? 'animate-spin' : ''}`}
          style={{ transform: `rotate(${pullDistance * 3}deg)` }}
        />
      </div>

      <h1 className="text-xl font-bold text-gray-900 mb-1">Safety Feed</h1>
      <p className="text-sm text-gray-500 mb-4">Share updates, photos, and reminders with the team.</p>

      {/* Composer */}
      <form onSubmit={handlePost} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex gap-3">
          {profile && <Avatar name={profile.full_name} />}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share a safety update or reminder…"
            rows={2}
            className="flex-1 resize-none text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
          />
        </div>

        {imagePreview && (
          <div className="relative mt-3">
            <img src={imagePreview} alt="" className="w-full max-h-64 object-cover rounded-xl" />
            <button
              type="button"
              onClick={clearImage}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-emerald-700 transition-colors"
          >
            <ImagePlus size={18} />
            Photo
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={pickImage} className="hidden" />
          <button
            type="submit"
            disabled={posting || (!body.trim() && !image)}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-sm font-medium px-4 py-1.5 rounded-full transition-colors"
          >
            <Send size={14} />
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </form>

      {loading && <p className="text-gray-400 text-sm text-center py-8">Loading…</p>}

      {!loading && posts.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-12">No posts yet — be the first to share something!</p>
      )}

      <div className="space-y-3">
        {posts.map((post) => {
          const authorName = post.profiles?.full_name ?? 'Team'
          const canDelete = isAdmin || post.posted_by === profile?.id

          return (
            <article
              key={post.id}
              className={`bg-white rounded-xl shadow-sm border ${post.pinned ? 'border-amber-200' : 'border-gray-100'}`}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                <div className="flex items-center gap-2.5">
                  <Avatar name={authorName} />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{authorName}</p>
                    <p className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  {post.pinned && (
                    <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 mr-1">
                      <Pin size={10} />
                      Pinned
                    </span>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => togglePin(post)}
                      title={post.pinned ? 'Unpin' : 'Pin to top'}
                      className="p-1.5 text-gray-300 hover:text-amber-500 rounded-lg transition-colors"
                    >
                      <Pin size={15} />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => deletePost(post)}
                      aria-label="Delete post"
                      className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Body */}
              {post.body && (
                <p className="px-4 pb-3 text-gray-800 text-sm whitespace-pre-wrap">{post.body}</p>
              )}

              {/* Image */}
              {post.image_path && (
                <img
                  src={getImageUrl(post.image_path)}
                  alt=""
                  className="w-full max-h-96 object-cover"
                  loading="lazy"
                />
              )}

              {/* Comments */}
              <CommentSection postId={post.id} postedBy={post.posted_by ?? ''} initialCount={post.post_comments?.length ?? 0} />
            </article>
          )
        })}
      </div>
    </div>
  )
}
