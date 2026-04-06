import { supabase } from './supabase'

export async function sendNotification(type: string, payload: Record<string, any>) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    if (!token) {
      console.error('Notification send failed: no active session token')
      return
    }

    await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ type, payload }),
    })
  } catch (err) {
    // Powiadomienia są nieblokujące — nie przerywamy akcji użytkownika
    console.error('Notification send failed:', err)
  }
}
