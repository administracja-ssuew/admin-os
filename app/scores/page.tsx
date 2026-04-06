// Server Component — NO 'use client' directive
// Auth guard runs before any HTML is sent to the browser.
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import ScoresClientPage from './ScoresClientPage'

export default async function ScoresPage() {
  const cookieStore = await cookies() // REQUIRED: async in Next.js 15+

  // Find the Supabase auth token cookie.
  // Supabase cookie name pattern: sb-<PROJECT_REF>-auth-token
  // Check for both plain and chunked variants (sb-<ref>-auth-token.0, .1, ...)
  const allCookies = cookieStore.getAll()

  // Development debug: log cookie names to confirm what the browser sends
  if (process.env.NODE_ENV === 'development') {
    console.log('[ScoresPage] cookies present:', allCookies.map(c => c.name))
  }

  // Try plain cookie first, then chunked (.0 suffix)
  const authCookie =
    allCookies.find(c => c.name.endsWith('-auth-token') && !c.name.includes('.')) ||
    allCookies.find(c => c.name.endsWith('-auth-token.0'))

  if (!authCookie?.value) {
    redirect('/login')
  }

  let accessToken: string | null = null
  try {
    // The cookie value may be URL-encoded and then JSON-stringified.
    // Common formats after decoding:
    //   Object format: { access_token: "...", refresh_token: "..." } -> accessToken = parsed.access_token
    //   Array format: [access_token, refresh_token] -> accessToken = parsed[0]
    const raw = decodeURIComponent(authCookie.value)
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      accessToken = typeof parsed[0] === 'string' ? parsed[0] : null
    } else if (parsed && typeof parsed === 'object' && typeof parsed.access_token === 'string') {
      accessToken = parsed.access_token
    }
    // If neither branch matches, accessToken stays null — we redirect to /login below.
    // This is the safe fallback: if the format is unexpected, we send the user to login
    // rather than blocking all users or silently ignoring the auth check.
  } catch {
    // JSON.parse failed — cookie value is not valid JSON, treat as unauthenticated
    redirect('/login')
  }

  if (!accessToken) {
    redirect('/login')
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken)
  if (userError || !user) {
    redirect('/login')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.system_role !== 'superadmin') {
    redirect('/?toast=access_denied')
  }

  return <ScoresClientPage />
}
