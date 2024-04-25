// This may require better organization but for now, just dumping functions here containing DB queries for moderation status

import { AtUri } from '@atproto/syntax'
import { Database } from '../db'
import { ModerationSubjectStatus } from '../db/schema/moderation_subject_status'
import {
  REVIEWOPEN,
  REVIEWCLOSED,
  REVIEWESCALATED,
  REVIEWNONE,
} from '../lexicon/types/tools/ozone/moderation/defs'
import { ModerationEventRow, ModerationSubjectStatusRow } from './types'
import { HOUR } from '@atproto/common'
import { REASONAPPEAL } from '../lexicon/types/com/atproto/moderation/defs'
import { jsonb } from '../db/types'

const getSubjectStatusForModerationEvent = ({
  currentStatus,
  action,
  createdBy,
  createdAt,
  durationInHours,
}: {
  currentStatus?: ModerationSubjectStatusRow
  action: string
  createdBy: string
  createdAt: string
  durationInHours: number | null
}): Partial<ModerationSubjectStatusRow> => {
  const defaultReviewState = currentStatus
    ? currentStatus.reviewState
    : REVIEWNONE

  switch (action) {
    case 'tools.ozone.moderation.defs#modEventAcknowledge':
      return {
        lastReviewedBy: createdBy,
        reviewState: REVIEWCLOSED,
        lastReviewedAt: createdAt,
      }
    case 'tools.ozone.moderation.defs#modEventReport':
      return {
        reviewState: REVIEWOPEN,
        lastReportedAt: createdAt,
      }
    case 'tools.ozone.moderation.defs#modEventEscalate':
      return {
        lastReviewedBy: createdBy,
        reviewState: REVIEWESCALATED,
        lastReviewedAt: createdAt,
      }
    case 'tools.ozone.moderation.defs#modEventReverseTakedown':
      return {
        lastReviewedBy: createdBy,
        reviewState: REVIEWCLOSED,
        takendown: false,
        suspendUntil: null,
        lastReviewedAt: createdAt,
      }
    case 'tools.ozone.moderation.defs#modEventUnmuteReporter':
      return {
        lastReviewedBy: createdBy,
        muteReportingUntil: null,
        // It's not likely to receive an unmute event that does not already have a status row
        // but if it does happen, default to unnecessary
        reviewState: defaultReviewState,
        lastReviewedAt: createdAt,
      }
    case 'tools.ozone.moderation.defs#modEventUnmute':
      return {
        lastReviewedBy: createdBy,
        muteUntil: null,
        // It's not likely to receive an unmute event that does not already have a status row
        // but if it does happen, default to unnecessary
        reviewState: defaultReviewState,
        lastReviewedAt: createdAt,
      }
    case 'tools.ozone.moderation.defs#modEventTakedown':
      return {
        takendown: true,
        lastReviewedBy: createdBy,
        reviewState: REVIEWCLOSED,
        lastReviewedAt: createdAt,
        suspendUntil: durationInHours
          ? new Date(Date.now() + durationInHours * HOUR).toISOString()
          : null,
      }
    case 'tools.ozone.moderation.defs#modEventMuteReporter':
      return {
        lastReviewedBy: createdBy,
        lastReviewedAt: createdAt,
        // By default, mute for 24hrs
        muteReportingUntil: new Date(
          Date.now() + (durationInHours || 24) * HOUR,
        ).toISOString(),
        // It's not likely to receive a mute event on a subject that does not already have a status row
        // but if it does happen, default to unnecessary
        reviewState: defaultReviewState,
      }
    case 'tools.ozone.moderation.defs#modEventMute':
      return {
        lastReviewedBy: createdBy,
        lastReviewedAt: createdAt,
        // By default, mute for 24hrs
        muteUntil: new Date(
          Date.now() + (durationInHours || 24) * HOUR,
        ).toISOString(),
        // It's not likely to receive a mute event on a subject that does not already have a status row
        // but if it does happen, default to unnecessary
        reviewState: defaultReviewState,
      }
    case 'tools.ozone.moderation.defs#modEventComment':
      return {
        lastReviewedBy: createdBy,
        lastReviewedAt: createdAt,
        reviewState: defaultReviewState,
      }
    case 'tools.ozone.moderation.defs#modEventTag':
      return { tags: [], reviewState: defaultReviewState }
    case 'tools.ozone.moderation.defs#modEventResolveAppeal':
      return {
        appealed: false,
      }
    default:
      return {}
  }
}

// Based on a given moderation action event, this function will update the moderation status of the subject
// If there's no existing status, it will create one
// If the action event does not affect the status, it will do nothing
export const adjustModerationSubjectStatus = async (
  db: Database,
  moderationEvent: ModerationEventRow,
  blobCids?: string[],
) => {
  const {
    action,
    subjectDid,
    subjectUri,
    subjectCid,
    createdBy,
    meta,
    addedTags,
    removedTags,
    comment,
    createdAt,
  } = moderationEvent

  // If subjectUri exists, it's not a repoRef so pass along the uri to get identifier back
  const identifier = getStatusIdentifierFromSubject(subjectUri || subjectDid)

  db.assertTransaction()

  const currentStatus = await db.db
    .selectFrom('moderation_subject_status')
    .where('did', '=', identifier.did)
    .where('recordPath', '=', identifier.recordPath)
    // Make sure we respect other updates that may be happening at the same time
    .forUpdate()
    .selectAll()
    .executeTakeFirst()

  // If reporting is muted for this reporter, we don't want to update the subject status
  if (meta?.isReporterMuted) {
    return currentStatus || null
  }

  const isAppealEvent =
    action === 'tools.ozone.moderation.defs#modEventReport' &&
    meta?.reportType === REASONAPPEAL

  const subjectStatus = getSubjectStatusForModerationEvent({
    currentStatus,
    action,
    createdBy,
    createdAt,
    durationInHours: moderationEvent.durationInHours,
  })

  const now = new Date().toISOString()
  if (
    currentStatus?.reviewState === REVIEWESCALATED &&
    subjectStatus.reviewState !== REVIEWCLOSED
  ) {
    // If the current status is escalated only allow incoming events to move the state to
    // reviewClosed because escalated subjects should never move to any other state
    subjectStatus.reviewState = REVIEWESCALATED
  }

  if (currentStatus && subjectStatus.reviewState === REVIEWNONE) {
    // reviewNone is ONLY allowed when there is no current status
    // If there is a current status, it should not be allowed to move back to reviewNone
    subjectStatus.reviewState = currentStatus.reviewState
  }

  // Set these because we don't want to override them if they're already set
  const defaultData = {
    comment: null,
    // Defaulting reviewState to open for any event may not be the desired behavior.
    // For instance, if a subject never had any event and we just want to leave a comment to keep an eye on it
    // that shouldn't mean we want to review the subject
    reviewState: REVIEWNONE,
    recordCid: subjectCid || null,
  }
  const newStatus = {
    ...defaultData,
    ...subjectStatus,
  }

  if (
    action === 'tools.ozone.moderation.defs#modEventReverseTakedown' &&
    !subjectStatus.takendown
  ) {
    newStatus.takendown = false
    subjectStatus.takendown = false
  }

  if (isAppealEvent) {
    newStatus.appealed = true
    subjectStatus.appealed = true
    newStatus.lastAppealedAt = createdAt
    subjectStatus.lastAppealedAt = createdAt
    // Set reviewState to escalated when appeal events are emitted
    subjectStatus.reviewState = REVIEWESCALATED
    newStatus.reviewState = REVIEWESCALATED
  }

  if (
    action === 'tools.ozone.moderation.defs#modEventResolveAppeal' &&
    subjectStatus.appealed
  ) {
    newStatus.appealed = false
    subjectStatus.appealed = false
  }

  if (
    action === 'tools.ozone.moderation.defs#modEventComment' &&
    meta?.sticky
  ) {
    newStatus.comment = comment
    subjectStatus.comment = comment
  }

  if (action === 'tools.ozone.moderation.defs#modEventTag') {
    let tags = currentStatus?.tags || []
    if (addedTags?.length) {
      tags = tags.concat(addedTags)
    }
    if (removedTags?.length) {
      tags = tags.filter((tag) => !removedTags.includes(tag))
    }
    newStatus.tags = jsonb([...new Set(tags)]) as unknown as string[]
    subjectStatus.tags = newStatus.tags
  }

  if (blobCids?.length) {
    const newBlobCids = jsonb(
      blobCids,
    ) as unknown as ModerationSubjectStatusRow['blobCids']
    newStatus.blobCids = newBlobCids
    subjectStatus.blobCids = newBlobCids
  }

  const insertQuery = db.db
    .insertInto('moderation_subject_status')
    .values({
      ...identifier,
      ...newStatus,
      createdAt: now,
      updatedAt: now,
    } as ModerationSubjectStatusRow)
    .onConflict((oc) =>
      oc.constraint('moderation_status_unique_idx').doUpdateSet({
        ...subjectStatus,
        updatedAt: now,
      }),
    )

  const status = await insertQuery.returningAll().executeTakeFirst()
  return status || null
}

type ModerationSubjectStatusFilter =
  | Pick<ModerationSubjectStatus, 'did'>
  | Pick<ModerationSubjectStatus, 'did' | 'recordPath'>
  | Pick<ModerationSubjectStatus, 'did' | 'recordPath' | 'recordCid'>
export const getModerationSubjectStatus = async (
  db: Database,
  filters: ModerationSubjectStatusFilter,
) => {
  let builder = db.db
    .selectFrom('moderation_subject_status')
    // DID will always be passed at the very least
    .where('did', '=', filters.did)
    .where('recordPath', '=', 'recordPath' in filters ? filters.recordPath : '')

  if ('recordCid' in filters) {
    builder = builder.where('recordCid', '=', filters.recordCid)
  } else {
    builder = builder.where('recordCid', 'is', null)
  }

  return builder.executeTakeFirst()
}

export const getStatusIdentifierFromSubject = (
  subject: string | AtUri,
): { did: string; recordPath: string } => {
  const isSubjectString = typeof subject === 'string'
  if (isSubjectString && subject.startsWith('did:')) {
    return {
      did: subject,
      recordPath: '',
    }
  }

  if (isSubjectString && !subject.startsWith('at://')) {
    throw new Error('Subject is neither a did nor an at-uri')
  }

  const uri = isSubjectString ? new AtUri(subject) : subject
  return {
    did: uri.host,
    recordPath: `${uri.collection}/${uri.rkey}`,
  }
}
