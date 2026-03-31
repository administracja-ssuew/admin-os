import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabase = createClient(supabaseUrl!, supabaseKey!)

    const { data: { user } } = await supabase.auth.getUser(token)

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const credToken = process.env.CRED_TOKEN
    const credApiUrl = process.env.CRED_API_URL

    const { searchParams } = new URL(request.url)
    const params = Object.fromEntries(searchParams.entries())

    const qs = new URLSearchParams({
      ...params,
      token: credToken!,
      autor: user.email!,
    }).toString()

    const res = await fetch(`${credApiUrl}?${qs}`)
    const data = await res.json()

    return Response.json(data)
  } catch (err) {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
