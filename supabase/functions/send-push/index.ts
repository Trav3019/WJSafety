// Supabase Edge Function: sends a web push notification to subscribed
// devices when a news post is created (everyone) or a form is assigned
// (just that worker). Triggered by the SQL triggers in
// supabase/migrations/002_push_notifications.sql.
//
// Deploy with: supabase functions deploy send-push
// Required secrets (supabase secrets set ...):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:you@example.com)
//   WEBHOOK_SECRET (must match app.settings.edge_function_secret from the migration)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (SUPABASE_* are auto-provided by the platform)

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com'
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET')!

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async (req) => {
  // Accept either a DB webhook secret (from triggers) or a valid user JWT (from the app)
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
    // Send to all admins — join through profiles table
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
    const adminIds = (adminProfiles ?? []).map((p: { id: string }) => p.id)
    if (adminIds.length === 0) return new Response('no admins', { status: 200 })
    query = query.in('user_id', adminIds)
  } else {
    return new Response('Unknown event type', { status: 400 })
  }

  const { data: subs, error } = await query
  if (error) return new Response(error.message, { status: 500 })

  const results = await Promise.allSettled(
    (subs ?? []).map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({ title, body }),
      ),
    ),
  )

  // Drop subscriptions that are no longer valid (browser unsubscribed, etc.)
  const expired = (subs ?? []).filter((_, i) => {
    const r = results[i]
    return r.status === 'rejected' && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0)
  })
  if (expired.length) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('id', expired.map((s) => s.id))
  }

  return new Response(JSON.stringify({ sent: results.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
