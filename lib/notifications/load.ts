import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Person } from './resolve.ts'

const PERSON = 'id, email, first_name, last_name, system_role'

/** Klient z service role — tylko na serwerze. Null, gdy brak klucza. */
export function serviceClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } })
}

export async function loadPersonById(db: SupabaseClient, id: string | null): Promise<Person | null> {
  if (!id) return null
  const { data } = await db.from('users').select(PERSON).eq('id', id).maybeSingle()
  return (data as Person | null) ?? null
}

export async function loadPersonByEmail(db: SupabaseClient, email: string): Promise<Person | null> {
  const { data } = await db.from('users').select(PERSON).eq('email', email).maybeSingle()
  return (data as Person | null) ?? null
}

export async function loadBoard(db: SupabaseClient): Promise<Person[]> {
  const { data } = await db.from('users').select(PERSON).in('system_role', ['admin', 'superadmin'])
  return (data as Person[] | null) ?? []
}
