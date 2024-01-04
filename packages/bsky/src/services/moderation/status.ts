// This may require better organization but for now, just dumping functions here containing DB queries for moderation status

import { AtUri } from '@atproto/syntax'
import { PrimaryDatabase } from '../../db'
import { ModerationSubjectStatus } from '../../db/tables/moderation'
import {
  REVIEWOPEN,
  REVIEWCLOSED,
  REVIEWESCALATED,
} from '../../lexicon/types/com/atproto/admin/defs'
import { ModerationEventRow, ModerationSubjectStatusRow } from './types'
import { HOUR } from '@atproto/common'
import { CID } from 'multiformats/cid'
import { sql } from 'kysely'
import { REASONAPPEAL } from '../../lexicon/types/com/atproto/moderation/defs'

const getSubjectStatusForModerationEvent = ({
  action,
  createdBy,
  createdAt,
  durationInHours,
}: {
  action: string
  createdBy: string
  createdAt: string
  durationInHours: number | null
}): Partial<ModerationSubjectStatusRow> | null => {
  switch (action) {
    case 'com.atproto.admin.defs#modEventAcknowledge':
      return {
        lastReviewedBy: createdBy,
        reviewState: REVIEWCLOSED,
        lastReviewedAt: createdAt,
      }
    case 'com.atproto.admin.defs#modEventReport':
      return {
        reviewState: REVIEWOPEN,
        lastReportedAt: createdAt,
      }
    case 'com.atproto.admin.defs#modEventEscalate':
      return {
        lastReviewedBy: createdBy,
        reviewState: REVIEWESCALATED,
        lastReviewedAt: createdAt,
      }
    case 'com.atproto.admin.defs#modEventReverseTakedown':
      return {
        lastReviewedBy: createdBy,
        reviewState: REVIEWCLOSED,
        takendown: false,
        suspendUntil: null,
        lastReviewedAt: createdAt,
      }
    case 'com.atproto.admin.defs#modEventUnmute':
      return {
        lastReviewedBy: createdBy,
        muteUntil: null,
        reviewState: REVIEWOPEN,
        lastReviewedAt: createdAt,
      }
    case 'com.atproto.admin.defs#modEventTakedown':
      return {
        takendown: true,
        lastReviewedBy: createdBy,
        reviewState: REVIEWCLOSED,
        lastReviewedAt: createdAt,
        suspendUntil: durationInHours
          ? new Date(Date.now() + durationInHours * HOUR).toISOString()
          : null,
      }
    case 'com.atproto.admin.defs#modEventMute':
      return {
        lastReviewedBy: createdBy,
        reviewState: REVIEWOPEN,
        lastReviewedAt: createdAt,
        // By default, mute for 24hrs
        muteUntil: new Date(
          Date.now() + (durationInHours || 24) * HOUR,
        ).toISOString(),
      }
    case 'com.atproto.admin.defs#modEventComment':
      return {
        lastReviewedBy: createdBy,
        lastReviewedAt: createdAt,
      }
    case 'com.atproto.admin.defs#modEventResolveAppeal':
      return {
        appealed: false,
      }
    default:
      return null
  }
}

// Based on a given moderation action event, this function will update the moderation status of the subject
// If there's no existing status, it will create one
// If the action event does not affect the status, it will do nothing
export const adjustModerationSubjectStatus = async (
  db: PrimaryDatabase,
  moderationEvent: ModerationEventRow,
  blobCids?: CID[],
) => {
  const {
    action,
    subjectDid,
    subjectUri,
    subjectCid,
    createdBy,
    meta,
    comment,
    createdAt,
  } = moderationEvent

  const isAppealEvent =
    action === 'com.atproto.admin.defs#modEventReport' &&
    meta?.reportType === REASONAPPEAL

  const subjectStatus = getSubjectStatusForModerationEvent({
    action,
    createdBy,
    createdAt,
    durationInHours: moderationEvent.durationInHours,
  })

  // If there are no subjectStatus that means there are no side-effect of the incoming event
  if (!subjectStatus) {
    return null
  }

  const now = new Date().toISOString()
  // If subjectUri exists, it's not a repoRef so pass along the uri to get identifier back
  const identifier = getStatusIdentifierFromSubject(subjectUri || subjectDid)

  db.assertTransaction()

  const currentStatus = await db.db
    .selectFrom('moderation_subject_status')
    .where('did', '=', identifier.did)
    .where('recordPath', '=', identifier.recordPath)
    .selectAll()
    .executeTakeFirst()

  if (
    currentStatus?.reviewState === REVIEWESCALATED &&
    subjectStatus.reviewState === REVIEWOPEN
  ) {
    // If the current status is escalated and the incoming event is to open the review
    // We want to keep the status as escalated
    subjectStatus.reviewState = REVIEWESCALATED
  }

  // Set these because we don't want to override them if they're already set
  const defaultData = {
    comment: null,
    // Defaulting reviewState to open for any event may not be the desired behavior.
    // For instance, if a subject never had any event and we just want to leave a comment to keep an eye on it
    // that shouldn't mean we want to review the subject
    reviewState: REVIEWOPEN,
    recordCid: subjectCid || null,
  }
  const newStatus = {
    ...defaultData,
    ...subjectStatus,
  }

  if (
    action === 'com.atproto.admin.defs#modEventReverseTakedown' &&
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
  }

  if (
    action === 'com.atproto.admin.defs#modEventResolveAppeal' &&
    subjectStatus.appealed
  ) {
    newStatus.appealed = false
    subjectStatus.appealed = false
  }

  if (action === 'com.atproto.admin.defs#modEventComment' && meta?.sticky) {
    newStatus.comment = comment
    subjectStatus.comment = comment
  }

  if (blobCids?.length) {
    const newBlobCids = sql<string[]>`${JSON.stringify(
      blobCids.map((c) => c.toString()),
    )}` as unknown as ModerationSubjectStatusRow['blobCids']
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
      // TODO: Need to get the types right here.
    } as ModerationSubjectStatusRow)
    .onConflict((oc) =>
      oc.constraint('moderation_status_unique_idx').doUpdateSet({
        ...subjectStatus,
        updatedAt: now,
      }),
    )

  const status = await insertQuery.executeTakeFirst()
  return status
}

type ModerationSubjectStatusFilter =
  | Pick<ModerationSubjectStatus, 'did'>
  | Pick<ModerationSubjectStatus, 'did' | 'recordPath'>
  | Pick<ModerationSubjectStatus, 'did' | 'recordPath' | 'recordCid'>
export const getModerationSubjectStatus = async (
  db: PrimaryDatabase,
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
