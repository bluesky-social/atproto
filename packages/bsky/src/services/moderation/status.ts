// This may require better organization but for now, just dumping functions here containing DB queries for moderation status

import { AtUri } from '@atproto/syntax'
import { PrimaryDatabase } from '../../db'
import {
  ModerationEvent,
  ModerationSubjectStatus,
} from '../../db/tables/moderation'
import {
  REVIEWOPEN,
  REVIEWCLOSED,
  REVIEWESCALATED,
} from '../../lexicon/types/com/atproto/admin/defs'
import { ModerationSubjectStatusRow } from './types'
import { HOUR } from '@atproto/common'

const getSubjectStatusForModerationEvent = ({
  action,
  durationInHours,
}: {
  action: string
  durationInHours: number | null
}): Partial<ModerationSubjectStatusRow> | null => {
  switch (action) {
    case 'com.atproto.admin.defs#modEventAcknowledge':
      return {
        reviewState: REVIEWCLOSED,
        lastReviewedAt: new Date().toISOString(),
      }
    case 'com.atproto.admin.defs#modEventReport':
      return {
        reviewState: REVIEWOPEN,
        lastReportedAt: new Date().toISOString(),
      }
    case 'com.atproto.admin.defs#modEventEscalate':
      return {
        reviewState: REVIEWESCALATED,
        lastReviewedAt: new Date().toISOString(),
      }
    case 'com.atproto.admin.defs#modEventReverseTakedown':
      return {
        reviewState: REVIEWCLOSED,
        lastReviewedAt: new Date().toISOString(),
      }
    case 'com.atproto.admin.defs#modEventTakedown':
      return {
        takendown: true,
        reviewState: REVIEWCLOSED,
        lastReviewedAt: new Date().toISOString(),
      }
    case 'com.atproto.admin.defs#modEventMute':
      return {
        // By default, mute for 24hrs
        muteUntil: new Date(
          Date.now() + (durationInHours || 24) * HOUR,
        ).toISOString(),
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
  moderationEvent: Pick<
    ModerationEvent,
    | 'action'
    | 'subjectType'
    | 'subjectDid'
    | 'subjectUri'
    | 'subjectCid'
    | 'durationInHours'
    | 'refEventId'
  >,
) => {
  const { action, subjectDid, subjectUri, subjectCid } = moderationEvent

  const subjectStatus = getSubjectStatusForModerationEvent({
    action,
    durationInHours: moderationEvent.durationInHours,
  })

  if (!subjectStatus) {
    return null
  }

  const now = new Date().toISOString()
  // If subjectUri exists, it's not a repoRef so pass along the uri to get identifier back
  const identifier = getStatusIdentifierFromSubject(subjectUri || subjectDid)

  // Set these because we don't want to override them if they're already set
  const defaultData = {
    note: null,
    reviewState: null,
    recordCid: subjectCid || null,
  }
  const newStatus = {
    ...defaultData,
    ...subjectStatus,
    ...identifier,
    createdAt: now,
    updatedAt: now,
    // TODO: fix this?
    // @ts-ignore
  } as ModerationSubjectStatusRow

  if (
    action === 'com.atproto.admin.defs#modEventReverseTakedown' &&
    !subjectStatus.takendown
  ) {
    newStatus.takendown = false
    subjectStatus.takendown = false
  }

  const insertQuery = db.db
    .insertInto('moderation_subject_status')
    .values(newStatus)
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

export const getStatusIdentifierFromSubject = (subject: string | AtUri) => {
  if (typeof subject === 'string' && subject.startsWith('did:')) {
    return {
      did: subject,
    }
  }

  const uri = typeof subject === 'string' ? new AtUri(subject) : subject
  return {
    did: uri.host,
    recordPath: `${uri.collection}/${uri.rkey}`,
  }
}
