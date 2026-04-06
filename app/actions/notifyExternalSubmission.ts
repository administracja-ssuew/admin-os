'use server'

// Server Action: called from the 'use client' /wniosek form.
// EXTERNAL_NOTIFICATIONS_SECRET is read here (server-side) — it NEVER reaches the browser.
export async function notifyExternalSubmission(payload: {
  caseNumber: string
  caseTitle: string
  caseType: string
  contactEmail: string
}): Promise<void> {
  const secret = process.env.EXTERNAL_NOTIFICATIONS_SECRET
  if (!secret) {
    console.error('notifyExternalSubmission: EXTERNAL_NOTIFICATIONS_SECRET is not set')
    return
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    const res = await fetch(`${baseUrl}/api/notifications/external`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-external-secret': secret,
      },
      body: JSON.stringify({
        type: 'external_submission',
        payload,
      }),
    })
    if (!res.ok) {
      console.error(`notifyExternalSubmission: endpoint returned ${res.status}`)
    }
  } catch (err) {
    console.error('notifyExternalSubmission: fetch failed', err)
  }
}
