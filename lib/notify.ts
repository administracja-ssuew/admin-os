import { supabase } from './supabase'
import type { ClientEvent } from './notifications/events.ts'

/** Zgłasza zdarzenie; serwer sam ustala odbiorców i treść. Błąd nie przerywa akcji użytkownika. */
export async function notify(event: ClientEvent, id: string | null | undefined) {
  if (!id) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ event, id }),
    })
  } catch (err) {
    console.error('Notification failed:', err)
  }
}
