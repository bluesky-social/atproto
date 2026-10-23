export type ActivityModTool = {
  name: string
  meta?: Record<string, unknown>
}

const LIFECYCLE_FIELDS = new Set([
  'resolution',
  'actionEventId',
  'appealOutcome',
  'createdBy',
  'isAutomated',
  'reportId',
  'activityType',
  'status',
  'previousStatus',
  'nextStatus',
  'createdAt',
  'updatedAt',
  'closedAt',
])

/** Keep lifecycle fields owned by the activity writer. */
export function getActivityMetadata(
  meta?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!meta) return
  return Object.fromEntries(
    Object.entries(meta).filter(([key]) => !LIFECYCLE_FIELDS.has(key)),
  )
}

/** Reuse event tool metadata on its report activities. */
export function getEventActivityMetadata(
  modTool?: ActivityModTool,
): Record<string, unknown> | undefined {
  if (!modTool) return
  return getActivityMetadata({
    ...modTool.meta,
    source: modTool.meta?.source ?? modTool.name,
  })
}
