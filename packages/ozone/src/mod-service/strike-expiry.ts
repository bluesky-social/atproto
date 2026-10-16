import { DAY } from '@atproto/common'
import { type DatetimeString, toDatetimeString } from '@atproto/lex'
import { tools } from '../lexicons/index.js'
import type { ModerationEventRow } from './types.js'

export type StrikeExpiryPolicy = Record<string, number | null>
export type StrikeEvent = Pick<
  ModerationEventRow,
  | 'id'
  | 'action'
  | 'subjectType'
  | 'subjectUri'
  | 'subjectConvoId'
  | 'subjectMessageId'
  | 'createdAt'
  | 'severityLevel'
  | 'strikeCount'
  | 'strikeExpiresAt'
  | 'meta'
>

export function severityKey(name: string): string {
  return name.toLowerCase().replace(/\s/g, '-')
}

export function policyStrikeExpiry(
  createdAt: DatetimeString,
  days: number | null,
): DatetimeString | null {
  if (!days) return null
  const expiresAt = new Date(Date.parse(createdAt) + days * DAY)
  if (
    !Number.isFinite(expiresAt.getTime()) ||
    expiresAt.getUTCFullYear() > 9999
  ) {
    throw new Error('Strike expiry exceeds the supported date range')
  }
  return toDatetimeString(expiresAt)
}

/** Reversals inherit the original strike's expiry, including after a policy edit. */
export function reconcileStrikeEvents(
  events: StrikeEvent[],
  policy: StrikeExpiryPolicy,
  {
    adoptLegacy = false,
    newEventId,
  }: { adoptLegacy?: boolean; newEventId?: number } = {},
): { events: StrikeEvent[]; unmatchedReversals: number[] } {
  const result: StrikeEvent[] = []
  const available = new Map<number, number>()
  const unmatchedReversals: number[] = []
  const defs = tools.ozone.moderation.defs

  for (const original of events) {
    const event = { ...original, meta: { ...original.meta } }
    const count = event.strikeCount ?? 0
    if (count > 0 && event.action === defs.modEventReverseTakedown.$type) {
      unmatchedReversals.push(event.id)
      result.push(event)
      continue
    }
    if (count > 0) {
      const level = event.severityLevel && severityKey(event.severityLevel)
      const knownLevel = !!level && Object.hasOwn(policy, level)
      const managed =
        event.meta.strikeExpiryPolicy === true ||
        ((adoptLegacy || event.id === newEventId) &&
          event.strikeExpiresAt === null &&
          knownLevel)
      if (
        managed &&
        knownLevel &&
        (event.action === defs.modEventTakedown.$type ||
          event.action === defs.modEventEmail.$type)
      ) {
        event.meta.strikeExpiryPolicy = true
        event.strikeExpiresAt = policyStrikeExpiry(
          event.createdAt,
          policy[level],
        )
      }
      if (event.action === defs.modEventTakedown.$type)
        available.set(event.id, count)
    } else if (count < 0) {
      const linkedId = event.meta.strikeReversalOf
      const source = result.findLast(
        (candidate) =>
          candidate.action === defs.modEventTakedown.$type &&
          (linkedId === undefined || linkedId === candidate.id) &&
          candidate.subjectType === event.subjectType &&
          candidate.subjectUri === event.subjectUri &&
          candidate.subjectConvoId === event.subjectConvoId &&
          candidate.subjectMessageId === event.subjectMessageId,
      )
      if (
        event.action !== defs.modEventReverseTakedown.$type ||
        !source ||
        (available.get(source.id) ?? 0) < -count ||
        (event.severityLevel &&
          (!source.severityLevel ||
            severityKey(source.severityLevel) !==
              severityKey(event.severityLevel)))
      ) {
        unmatchedReversals.push(event.id)
      } else {
        available.set(source.id, available.get(source.id)! + count)
        if (linkedId !== undefined || adoptLegacy || event.id === newEventId) {
          event.meta.strikeReversalOf = source.id
          event.strikeExpiresAt = source.strikeExpiresAt
        }
      }
    }
    result.push(event)
  }
  return { events: result, unmatchedReversals }
}
