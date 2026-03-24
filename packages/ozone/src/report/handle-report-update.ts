/**
 * Pure, synchronous state-transition logic for reports.
 *
 * Every code path that changes a report's status or creates a report activity
 * should call `handleReportUpdate` to determine the next status and the
 * activity record to insert. This keeps the state machine in one place and
 * decouples it from DB operations so it works for both single-row transactions
 * and bulk updates.
 */

// ---------------------------------------------------------------------------
// Error types — callers decide how to surface these (throw, skip, etc.)
// ---------------------------------------------------------------------------

export class AlreadyInTargetState extends Error {
  constructor(
    public currentStatus: string,
    public targetStatus: string,
  ) {
    super(`Report is already in '${targetStatus}' status`)
    this.name = 'AlreadyInTargetState'
  }
}

export class InvalidStateTransition extends Error {
  constructor(
    public fromStatus: string,
    public toStatus: string,
  ) {
    super(`Cannot transition report from '${fromStatus}' to '${toStatus}'`)
    this.name = 'InvalidStateTransition'
  }
}

// ---------------------------------------------------------------------------
// State machine tables
// ---------------------------------------------------------------------------

/** Valid state transitions: key = fromState, value = allowed toStates */
export const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ['closed', 'escalated', 'queued', 'assigned'],
  closed: ['open'],
  escalated: ['open', 'closed'],
  queued: ['assigned', 'open'],
  assigned: ['open', 'closed', 'escalated'],
}

/** Activity types that map to a specific target status */
const ACTIVITY_TO_STATE: Record<string, string> = {
  queueActivity: 'queued',
  assignmentActivity: 'assigned',
  escalationActivity: 'escalated',
  closeActivity: 'closed',
  reopenActivity: 'open',
}

/** Activity types that are only valid from specific source states */
const ACTIVITY_VALID_FROM_STATES: Record<string, string[]> = {
  reopenActivity: ['closed'],
}

/** Moderation event types → target status (+ activity type) */
const EVENT_TYPE_MAP: Record<string, { status: string; activityType: string }> =
  {
    'tools.ozone.moderation.defs#modEventAcknowledge': {
      status: 'closed',
      activityType: 'closeActivity',
    },
    'tools.ozone.moderation.defs#modEventTakedown': {
      status: 'closed',
      activityType: 'closeActivity',
    },
    'tools.ozone.moderation.defs#modEventLabel': {
      status: 'closed',
      activityType: 'closeActivity',
    },
    'tools.ozone.moderation.defs#modEventComment': {
      status: 'closed',
      activityType: 'closeActivity',
    },
    'tools.ozone.moderation.defs#modEventEscalate': {
      status: 'escalated',
      activityType: 'escalationActivity',
    },
  }

// ---------------------------------------------------------------------------
// Action types — the three ways a report's status can change
// ---------------------------------------------------------------------------

export type ReportUpdateAction =
  | { type: 'activity'; activityType: string }
  | { type: 'event'; eventType: string }
  | { type: 'queue' }

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type ActivityRecord = {
  activityType: string
  previousStatus: string
}

export type ReportUpdateResult = {
  nextStatus: string | null
  activity: ActivityRecord | null
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Determines the next status and activity record for a report update.
 *
 * @throws AlreadyInTargetState if the report is already in the target status
 * @throws InvalidStateTransition if the transition is not allowed
 * @returns nextStatus (null = no change) and activity (null = nothing to record)
 */
export function handleReportUpdate(
  currentStatus: string,
  action: ReportUpdateAction,
): ReportUpdateResult {
  switch (action.type) {
    case 'activity':
      return handleActivityAction(currentStatus, action.activityType)
    case 'event':
      return handleEventAction(currentStatus, action.eventType)
    case 'queue':
      return handleQueueAction(currentStatus)
  }
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

function handleActivityAction(
  currentStatus: string,
  activityType: string,
): ReportUpdateResult {
  const toState = ACTIVITY_TO_STATE[activityType] ?? null

  // Note-type activities — no state change, but still produce an activity record
  if (toState === null) {
    return { nextStatus: null, activity: null }
  }

  // Check activity-specific source-state constraints
  const validFromStates = ACTIVITY_VALID_FROM_STATES[activityType]
  if (validFromStates && !validFromStates.includes(currentStatus)) {
    throw new InvalidStateTransition(currentStatus, toState)
  }

  validateTransition(currentStatus, toState)

  return {
    nextStatus: toState,
    activity: { activityType, previousStatus: currentStatus },
  }
}

function handleEventAction(
  currentStatus: string,
  eventType: string,
): ReportUpdateResult {
  const mapping = EVENT_TYPE_MAP[eventType]
  if (!mapping) {
    // Event type doesn't affect report status
    return { nextStatus: null, activity: null }
  }

  validateTransition(currentStatus, mapping.status)

  return {
    nextStatus: mapping.status,
    activity: {
      activityType: mapping.activityType,
      previousStatus: currentStatus,
    },
  }
}

function handleQueueAction(currentStatus: string): ReportUpdateResult {
  // Queue routing only transitions open → queued
  if (currentStatus !== 'open') {
    return { nextStatus: null, activity: null }
  }

  return {
    nextStatus: 'queued',
    activity: { activityType: 'queueActivity', previousStatus: currentStatus },
  }
}

// ---------------------------------------------------------------------------
// Shared validation
// ---------------------------------------------------------------------------

function validateTransition(fromStatus: string, toStatus: string): void {
  if (fromStatus === toStatus) {
    throw new AlreadyInTargetState(fromStatus, toStatus)
  }
  const allowed = VALID_TRANSITIONS[fromStatus] ?? []
  if (!allowed.includes(toStatus)) {
    throw new InvalidStateTransition(fromStatus, toStatus)
  }
}
