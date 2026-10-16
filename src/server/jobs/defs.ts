export type JobDef = { key: string; name: string; description: string; intervalMinutes: number; safeManual: boolean };

/** Registry of scheduled jobs. Handlers live in ./handlers.ts; the worker (scripts/worker.ts) or /api/cron/[job] runs them. */
export const JOB_DEFS: JobDef[] = [
  { key: "reconcile_counters", name: "Reconcile engagement counters", description: "Recomputes like / comment / share counters from source rows.", intervalMinutes: 60, safeManual: true },
  { key: "cleanup_auth", name: "Clean expired sessions and tokens", description: "Deletes expired sessions and used / expired verification tokens.", intervalMinutes: 120, safeManual: true },
  { key: "log_retention", name: "Log retention cleanup", description: "Removes system logs older than 30 days, security events older than 180 days and audit logs older than 730 days.", intervalMinutes: 1440, safeManual: false },
  { key: "expire_promotions", name: "Expire finished promotions", description: "Marks promotions past their end date as ended and activates approved scheduled ones.", intervalMinutes: 15, safeManual: true },
  { key: "complete_trips", name: "Complete past trips", description: "Marks published trips whose end date has passed as completed.", intervalMinutes: 360, safeManual: true },
  { key: "message_retention", name: "Message retention", description: "Deletes messages older than the configured retention window (0 = keep forever).", intervalMinutes: 1440, safeManual: false },
  { key: "draft_cleanup", name: "Delete stale drafts", description: "Removes post drafts older than the configured draft retention.", intervalMinutes: 1440, safeManual: false },
  { key: "process_deletions", name: "Process account deletion requests", description: "Anonymises accounts whose deletion request is older than 7 days.", intervalMinutes: 60, safeManual: false },
  { key: "media_orphans", name: "Check broken media references", description: "Reports media rows whose files are missing on disk (read-only diagnostic).", intervalMinutes: 1440, safeManual: true },
];
