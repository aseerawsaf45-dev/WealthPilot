// Privacy & Security Audit Logging Service
import { AuditEvent } from '../types/finance';

const AUDIT_STORAGE_KEY = 'wealthpilot_audit_log';

export function getAuditLogs(): AuditEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function logAuditEvent(
  action: string,
  entityType: string,
  entityId: string,
  details: string,
  userId = 'user_pilot'
): AuditEvent {
  // Redact any potential credentials/secrets
  const redactedDetails = details
    .replace(/(password|token|secret|key)=([^&\s]+)/gi, '$1=[REDACTED]')
    .slice(0, 300);

  const event: AuditEvent = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    timestamp: new Date().toISOString(),
    action,
    entityType,
    entityId,
    details: redactedDetails,
    ipAddressMask: '127.0.0.1 (Local)',
  };

  if (typeof window !== 'undefined') {
    try {
      const logs = getAuditLogs();
      logs.unshift(event);
      // Keep last 100 audit events for local retention limit
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(logs.slice(0, 100)));
    } catch (e) {
      console.warn('Failed to persist audit log', e);
    }
  }

  return event;
}
