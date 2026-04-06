import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// createBrowserClient stores the session in cookies (in addition to localStorage),
// enabling server components to read the session via createServerClient.
// Safe to call in SSR/API routes: document-access is guarded internally.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)