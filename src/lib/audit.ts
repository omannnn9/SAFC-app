import { supabase } from "@/integrations/supabase/client";

/**
 * Write an immutable audit log entry via the SECURITY DEFINER function
 * `public.log_audit`. The function is the only allowed writer of audit_logs
 * (no INSERT policy on the table). Failures are logged but never thrown,
 * so audit logging never blocks the user-facing action.
 */
export async function logAudit(
  actionType: string,
  targetType: string,
  targetId?: string | null,
  beforeValue?: unknown,
  afterValue?: unknown,
  metadata?: unknown,
): Promise<void> {
  try {
    const { error } = await supabase.rpc("log_audit", {
      _action_type: actionType,
      _target_type: targetType,
      _target_id: targetId ?? null,
      _before: (beforeValue ?? null) as never,
      _after: (afterValue ?? null) as never,
      _metadata: (metadata ?? null) as never,
    });
    if (error) console.warn("[audit]", error.message);
  } catch (e) {
    console.warn("[audit] failed", e);
  }
}
