import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '../email.ts'
import { notificationEmailTemplate } from '../email-templates.ts'
import { DEDUPE_FOREVER } from './events.ts'
import type { Outgoing } from './resolve.ts'

export const DEDUPE_WINDOW_MS = 10 * 60 * 1000

export interface NotificationStore {
  exists(userId: string, type: string, link: string, since: Date | null): Promise<boolean>
  insert(item: Outgoing): Promise<void>
}

/** Magazyn w tabeli notifications (klient z service role). */
export function supabaseStore(db: SupabaseClient): NotificationStore {
  return {
    async exists(userId, type, link, since) {
      let query = db.from('notifications').select('id').eq('user_id', userId).eq('type', type).eq('link', link).limit(1)
      if (since) query = query.gte('created_at', since.toISOString())
      const { data, error } = await query
      if (error) throw error
      return (data?.length ?? 0) > 0
    },
    async insert(item) {
      const { error } = await db.from('notifications').insert([{ user_id: item.userId, type: item.type, title: item.title, body: item.body, link: item.link }])
      if (error) throw error
    },
  }
}

export async function dispatch(
  store: NotificationStore,
  items: Outgoing[],
  deps: { now?: Date; send?: typeof sendEmail } = {}
): Promise<{ inserted: number; skipped: number; emailed: number; emailFailed: number }> {
  const now = deps.now ?? new Date()
  const send = deps.send ?? sendEmail
  const result = { inserted: 0, skipped: 0, emailed: 0, emailFailed: 0 }
  const seen = new Set<string>()

  for (const item of items) {
    const key = `${item.userId}|${item.type}|${item.link}`
    const since = DEDUPE_FOREVER.has(item.type) ? null : new Date(now.getTime() - DEDUPE_WINDOW_MS)
    if (seen.has(key) || await store.exists(item.userId, item.type, item.link, since)) {
      result.skipped++
      continue
    }
    seen.add(key)
    await store.insert(item)
    result.inserted++

    if (item.sendEmail && item.email) {
      const tpl = notificationEmailTemplate(item.title, item.body, item.link)
      const sent = await send({ to: item.email, subject: tpl.subject, html: tpl.html })
      if (sent.success) result.emailed++
      else if (!sent.skipped) result.emailFailed++
    }
  }
  return result
}
