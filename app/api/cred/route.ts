import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const cookieStore = await cookies()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage: {
          getItem: (key: string) => cookieStore.get(key)?.value ?? null,
          setItem: () => {},
          removeItem: () => {},
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const params = Object.fromEntries(searchParams.entries())

  const qs = new URLSearchParams({
    ...params,
    token: process.env.CRED_TOKEN!,
    autor: session.user.email!,
  }).toString()

  const res = await fetch(`${process.env.CRED_API_URL}?${qs}`)
  const data = await res.json()

  return Response.json(data)
}
