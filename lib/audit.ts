import { supabase } from './supabase'

interface AuditLogParams {
  userId: string
  action: string
  entityType: string
  entityId: string
  oldValue?: Record<string, any> | null
  newValue?: Record<string, any> | null
}

export async function logAudit({ userId, action, entityType, entityId, oldValue, newValue }: AuditLogParams) {
  const { error } = await supabase.from('audit_log').insert([{
    user_id: userId,
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
