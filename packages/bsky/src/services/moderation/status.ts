// This may require better organization but for now, just dumping functions here containing DB queries for moderation status

import { AtUri } from '@atproto/syntax'
import { PrimaryDatabase } from '../../db'
import {
  ModerationEvent,
  ModerationSubjectStatus,
} from '../../db/tables/moderation'
import {
  ACKNOWLEDGE,
  REVIEWOPEN,
  MUTE,
  REVIEWCLOSED,
  REPORT,
  REVIEWESCALATED,
  REVERT,
  TAKEDOWN,
  ESCALATE,
} from '../../lexicon/types/com/atproto/admin/defs'
import { ModerationEventRow, ModerationSubjectStatusRow } from './types'

const actionTypesImpactingStatus = [
  ACKNOWLEDGE,
  REPORT,
  ESCALATE,
  REVERT,
  TAKEDOWN,
  MUTE,
]

// TODO: How do we handle revert? for "revert" event we will have a reference event id that is being reversed
// We will probably need a helper that can take a list of events and compute the final state of the subject
// That helper will have to be invoked here with all events up until the point where the reverted event was created
const getSubjectStatusForModerationEvent = ({
  action,
  durationInHours,
}: {
  action: string
  durationInHours: number | null
}): Partial<ModerationSubjectStatusRow> | null => {
  switch (action) {
    case ACKNOWLEDGE:
      return {
        reviewState: REVIEWCLOSED,
        lastReviewedAt: new Date().toISOString(),
      }
    case REPORT:
      return {
        reviewState: REVIEWOPEN,
        lastReportedAt: new Date().toISOString(),
      }
    case ESCALATE:
      return {
        reviewState: REVIEWESCALATED,
        lastReviewedAt: new Date().toISOString(),
      }
    // REVERT can only come through when a revert event is emitted but there are no status impacting event
    // before it. In which case, we will default to REVIEWCLOSED
    case REVERT:
      return {
        reviewState: REVIEWCLOSED,
        lastReviewedAt: new Date().toISOString(),
      }
    case TAKEDOWN:
      return {
        takendown: true,
        reviewState: REVIEWCLOSED,
        lastReviewedAt: new Date().toISOString(),
      }
    case MUTE:
      return {
        // By default, mute for 24hrs
        muteUntil: new Date(
          Date.now() + (durationInHours || 24) * 60 * 60 * 1000,
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
  const { action, subjectDid, subjectUri, subjectCid, refEventId } =
    moderationEvent

  let actionForStatusMapping = {
    action,
    durationInHours: moderationEvent.durationInHours,
  }
  // TODO: Ugghhh hate this
  let revertingEvent: ModerationEventRow | undefined | Record<string, unknown>

  // For all events, we would want to map the new status based on the event itself
  // However, for revert events, they will be pointing to a previous event that needs to be reverted
  // In which case, we will have to find out the last event that changed the status before that reference event
  // and compute the new status based on that
  // TODO: We may need more here. For instance, if we're reverting a post takedown but since the takedown, we adjusted
  // labels on the post, does the takedown reversal mean those labels added AFTER the takedown should be reverted as well?
  if (action === REVERT && refEventId) {
    const [lastActionImpactingStatus, refEvent] = await Promise.all([
      getPreviousStatusForReversal(db, moderationEvent),
      db.db
        .selectFrom('moderation_event')
        .where('id', '=', refEventId)
        .selectAll()
        .executeTakeFirst(),
    ])
    revertingEvent = refEvent

    // If the action being reverted does not have a previously known/status impacting action,
    // passing revert itself will default to state to reviewclosed
    if (lastActionImpactingStatus) {
      actionForStatusMapping = {
        action: lastActionImpactingStatus.action,
        durationInHours: moderationEvent.durationInHours,
      }
    }
  }

  const subjectStatus = getSubjectStatusForModerationEvent(
    actionForStatusMapping,
  )

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

  // If the event being reverted is a takedown event and the new status
  // also doesn't settle on takendown revert back the takendown flag
  if (revertingEvent?.action === TAKEDOWN && !subjectStatus.takendown) {
    newStatus.takendown = false
    subjectStatus.takendown = false
  }

  const insertQuery = db.db
    .insertInto('moderation_subject_status')
    .values(newStatus)
    .onConflict((oc) =>
      oc.constraint('did_record_path_unique_idx').doUpdateSet({
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

/**
 * Given a revert event with a reference event id, this function will find the last action event that impacted the status
 * Which can then be used to determine the new status for the subject after the revert event
 * Potential flow of events may be
 * 1. Post is reported
 * 2. Post is labeled
 * 3. Post is taken down
 * 4. Comment left by a mod on the post
 * 5. Takedown is reverted
 *
 * At that point, event #5 will contain the refEventId #3 so this function will find the last event that impacted the status
 * of the post before event #3 which is #1 so that event will be returned
 * */
export const getPreviousStatusForReversal = async (
  db: PrimaryDatabase,
  moderationEvent: Pick<
    ModerationEventRow,
    'refEventId' | 'subjectType' | 'subjectCid' | 'subjectUri' | 'subjectDid'
  >,
) => {
  if (!moderationEvent.refEventId) {
    return null
  }
  const lastActionImpactingStatusQuery = db.db
    .selectFrom('moderation_event')
    .where('id', '<', moderationEvent.refEventId)
    .where('subjectType', '=', moderationEvent.subjectType)
    .where((qb) => {
      if (moderationEvent.subjectType === 'com.atproto.admin.defs#repoRef') {
        return qb
          .where('subjectDid', '=', moderationEvent.subjectDid)
          .where('subjectUri', 'is', null)
          .where('subjectCid', 'is', null)
      }

      return qb
        .where('subjectUri', '=', moderationEvent.subjectUri)
        .where('subjectCid', '=', moderationEvent.subjectCid)
    })
    .where(
      'action',
      'in',
      actionTypesImpactingStatus.filter(
        (status) => status !== REVERT,
      ) as ModerationEventRow['action'][],
    )
    // Make sure we get the last action event that impacted the status
    .orderBy('id', 'desc')
    .select('action')

  return lastActionImpactingStatusQuery.executeTakeFirst()
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
