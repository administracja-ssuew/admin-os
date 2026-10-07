import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '../email.ts'
import { notificationEmailTemplate } from '../email-templates.ts'
import { DEDUPE_FOREVER } from './events.ts'
import type { Outgoing } from './resolve.ts'

export const DEDUPE_WINDOW_MS = 10 * 60 * 1000

export interface NotificationStore {
  /**
   * Zapisuje powiadomienie, jeśli ten sam odbiorca nie ma już wpisu o tym samym typie i linku
   * od `since` (null = kiedykolwiek). Sprawdzenie i zapis są jedną operacją. Zwraca, czy zapisano.
   */
  insertOnce(item: Outgoing, since: Date | null): Promise<boolean>
}

/** Magazyn w tabeli notifications (klient z service role) — funkcja z migracji 20261007_notifications_dedupe.sql. */
export function supabaseStore(db: SupabaseClient): NotificationStore {
  return {
    async insertOnce(item, since) {
      const { data, error } = await db.rpc('insert_notification_once', {
        p_user_id: item.userId,
        p_type: item.type,
        p_title: item.title,
        p_body: item.body,
        p_link: item.link,
        p_since: since ? since.toISOString() : null,
      })
      if (error) throw error
      return data === true
    },
  }
}

export interface DispatchResult { inserted: number; skipped: number; emailed: number; emailFailed: number; failed: number }

export async function dispatch(
  store: NotificationStore,
  items: Outgoing[],
  deps: { now?: Date; send?: typeof sendEmail } = {}
): Promise<DispatchResult> {
  const now = deps.now ?? new Date()
  const send = deps.send ?? sendEmail
  const result: DispatchResult = { inserted: 0, skipped: 0, emailed: 0, emailFailed: 0, failed: 0 }
  const seen = new Set<string>()

  for (const item of items) {
    const key = `${item.userId}|${item.type}|${item.link}`
    if (seen.has(key)) {
      result.skipped++
      continue
    }
    seen.add(key)

    // Błąd jednego odbiorcy (baza, poczta) nie przerywa wysyłki do pozostałych
    let stored = false
    try {
      const since = DEDUPE_FOREVER.has(item.type) ? null : new Date(now.getTime() - DEDUPE_WINDOW_MS)
      stored = await store.insertOnce(item, since)
      if (!stored) {
        result.skipped++
        continue
      }
      result.inserted++

      // E-mail tylko wtedy, gdy wpis faktycznie powstał w tym wywołaniu
      if (item.sendEmail && item.email) {
        const tpl = notificationEmailTemplate(item.title, item.body, item.link)
        const sent = await send({ to: item.email, subject: tpl.subject, html: tpl.html })
        if (sent.success) result.emailed++
        else if (!sent.skipped) result.emailFailed++
      }
    } catch (err) {
      console.error('Powiadomienie nie zostało obsłużone:', item.type, item.link, err)
      if (stored) result.emailFailed++
      else result.failed++
    }
  }
  return result
}
