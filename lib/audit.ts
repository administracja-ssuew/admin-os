import { supabase } from './supabase'

interface AuditLogParams {
  userId: string | null
  action: string
  entityType: string
  entityId: string
  oldValue?: Record<string, any> | null
  newValue?: Record<string, any> | null
}

export async function logAudit({ userId, action, entityType, entityId, oldValue, newValue }: AuditLogParams) {
  // First, verify the userId actually exists in the users table.
  // If not (e.g. FK mismatch between auth.uid and users.id), fall back to null.
  let resolvedUserId: string | null = userId

  if (userId) {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()
    if (error || !data) {
      resolvedUserId = null
    }
  }

  const { error } = await supabase.from('audit_log').insert([{
    user_id: resolvedUserId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_value: oldValue ?? null,
    new_value: newValue ?? null,
  }])

  if (error) {
    console.error('Audit log error:', error.message)
  }
}
