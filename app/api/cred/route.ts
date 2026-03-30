import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const params = Object.fromEntries(searchParams.entries())

  const qs = new URLSearchParams({
    ...params,
    token: process.env.CRED_TOKEN!,
    autor: user.email!,
  }).toString()

  const res = await fetch(`${process.env.CRED_API_URL}?${qs}`)
  const data = await res.json()

  return Response.json(data)
}
