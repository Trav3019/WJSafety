import { supabase } from './supabase'

// Fire-and-forget: log a notification for one or more recipients.
// Fails silently if the table doesn't exist yet.
export async function logNotif(userIds: string | string[], title: string, body: string) {
  const ids = Array.isArray(userIds) ? userIds : [userIds]
  if (!ids.length) return
  await supabase.from('notification_log').insert(
    ids.map((user_id) => ({ user_id, title, body }))
  )
}

// Fetch all admin user IDs from profiles
export async function getAdminIds(): Promise<string[]> {
  const { data } = await supabase.from('profiles').select('id').eq('role', 'admin')
  return (data ?? []).map((p: { id: string }) => p.id)
}

// Fetch admin + manager IDs (for time-off notifications)
export async function getAdminAndManagerIds(): Promise<string[]> {
  const { data } = await supabase.from('profiles').select('id, role').in('role', ['admin', 'manager'])
  return (data ?? []).map((p: { id: string }) => p.id)
}
