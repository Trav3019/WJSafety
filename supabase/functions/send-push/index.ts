import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com'
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET')!

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

async function logNotification(userId: string, title: string, body: string) {
  await supabase.from('notification_log').insert({ user_id: userId, title, body })
}

async function sendToSubs(
  subs: { id: string; endpoint: string; p256dh: string; auth: string; user_id: string }[],
  title: string,
  body: string,
) {
  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body }),
      )
    )
  )

  // Log to notification_log for each unique user
  const userIds = [...new Set(subs.map((s) => s.user_id))]
  await Promise.allSettled(userIds.map((uid) => logNotification(uid, title, body)))

  // Drop expired subscriptions
  const expired = subs.filter((_, i) => {
    const r = results[i]
    if (r.status === 'rejected') {
      console.error('Push failed:', r.reason)
      return [401, 404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0)
    }
    return false
  })
  if (expired.length) {
    await supabase.from('push_subscriptions').delete().in('id', expired.map((s) => s.id))
  }

  return results.length
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
      },
    })
  }

  const webhookSecret = req.headers.get('x-webhook-secret')
  const hasAuth = req.headers.get('Authorization')?.startsWith('Bearer ')
  if (webhookSecret !== WEBHOOK_SECRET && !hasAuth) {
    return new Response('Unauthorized', { status: 401 })
  }

  const payload = await req.json()
  let title = 'WJ Safety'
  let body = ''
  let query = supabase.from('push_subscriptions').select('*')

  if (payload.type === 'news_post') {
    title = `New post from ${payload.poster_name}`
    body = payload.body
  } else if (payload.type === 'form_assigned') {
    title = 'New form to sign'
    body = payload.title
    query = query.eq('user_id', payload.user_id)
  } else if (payload.type === 'sign_assigned') {
    title = 'Document ready to sign'
    body = payload.title
    query = query.eq('user_id', payload.user_id)
  } else if (payload.type === 'comment_posted') {
    title = `${payload.commenter_name} commented on your post`
    body = ''
    query = query.eq('user_id', payload.user_id)
  } else if (payload.type === 'doc_signed') {
    title = `${payload.worker_name} signed a document`
    body = payload.doc_title
    const { data: adminProfiles } = await supabase.from('profiles').select('id').eq('role', 'admin')
    const adminIds = (adminProfiles ?? []).map((p: { id: string }) => p.id)
    if (adminIds.length === 0) return new Response('no admins', { status: 200 })
    query = query.in('user_id', adminIds)
  } else if (payload.type === 'incident_submitted') {
    title = `Incident report: ${payload.incident_type}`
    body = `Submitted by ${payload.worker_name}`
    const { data: adminProfiles } = await supabase.from('profiles').select('id').eq('role', 'admin')
    const adminIds = (adminProfiles ?? []).map((p: { id: string }) => p.id)
    if (adminIds.length === 0) return new Response('no admins', { status: 200 })
    query = query.in('user_id', adminIds)
  } else if (payload.type === 'daily_pending_reminder') {
    const { data: pending } = await supabase
      .from('sign_assignments')
      .select('assigned_to, sign_requests(title)')
      .eq('status', 'pending')

    const byWorker: Record<string, string[]> = {}
    for (const a of (pending ?? []) as { assigned_to: string; sign_requests: { title: string } }[]) {
      if (!byWorker[a.assigned_to]) byWorker[a.assigned_to] = []
      byWorker[a.assigned_to].push(a.sign_requests.title)
    }

    let notified = 0
    for (const [userId, titles] of Object.entries(byWorker)) {
      const { data: workerSubs } = await supabase.from('push_subscriptions').select('*').eq('user_id', userId)
      const count = titles.length
      const notifBody = titles.slice(0, 2).join(', ') + (count > 2 ? ` and ${count - 2} more` : '')
      const notifTitle = `You have ${count} unsigned document${count > 1 ? 's' : ''}`
      await Promise.allSettled(
        (workerSubs ?? []).map((sub) =>
          webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({ title: notifTitle, body: notifBody }),
          )
        )
      )
      await logNotification(userId, notifTitle, notifBody)
      notified++
    }
    return new Response(JSON.stringify({ notified }), { headers: { 'Content-Type': 'application/json' } })
  } else {
    return new Response('Unknown event type', { status: 400 })
  }

  const { data: subs, error } = await query
  if (error) return new Response(error.message, { status: 500 })

  const sent = await sendToSubs(subs ?? [], title, body)
  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } })
})
