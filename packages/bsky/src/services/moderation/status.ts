// This may require better organization but for now, just dumping functions here containing DB queries for moderation status

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
}): Partial<ModerationSubjectStatusRow> => {
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
    case REVERT:
      return {}
    case TAKEDOWN:
      return { takendown: true, lastReviewedAt: new Date().toISOString() }
    case MUTE:
      return { muteUntil: new Date().toISOString() }
    default:
      return {}
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
  const {
    action,
    subjectType,
    subjectDid,
    subjectUri,
    subjectCid,
    refEventId,
  } = moderationEvent

  let actionForStatusMapping = {
    action,
    durationInHours: moderationEvent.durationInHours,
  }

  // For all events, we would want to map the new status based on the event itself
  // However, for revert events, they will be pointing to a previous event that needs to be reverted
  // In which case, we will have to find out the last event that changed the status before that reference event
  // and compute the new status based on that
  // TODO: We may need more here. For instance, if we're reverting a post takedown but since the takedown, we adjusted
  // labels on the post, does the takedown reversal mean those labels added AFTER the takedown should be reverted as well?
  if (action === REVERT && refEventId) {
    const lastActionImpactingStatus = await getPreviousStatusForReversal(
      db,
      moderationEvent,
    )

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
  const identifier =
    subjectType === 'com.atproto.admin.defs#repoRef'
      ? { did: subjectDid }
      : { recordPath: subjectUri, recordCid: subjectCid } // TODO: Build the recordPath properly here
  const defaultData = {
    note: null,
    reviewState: null,
  }
  // TODO: fix this?
  // @ts-ignore
  return db.db
    .insertInto('moderation_subject_status')
    .values({
      ...identifier,
      ...defaultData,
      ...subjectStatus,
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) =>
      oc.constraint('moderation_subject_status_unique_key').doUpdateSet({
        ...subjectStatus,
        updatedAt: now,
      }),
    )
    .executeTakeFirst()
}

// TODO: The builder probably needs to handle null cases
export const getModerationSubjectStatus = async (
  db: PrimaryDatabase,
  {
    did,
    recordPath,
    recordCid,
  }: Pick<ModerationSubjectStatus, 'did' | 'recordPath' | 'recordCid'>,
) => {
  return db.db
    .selectFrom('moderation_subject_status')
    .where('did', '=', did)
    .where('recordPath', '=', recordPath)
    .where('recordCid', '=', recordCid)
    .executeTakeFirst()
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
  const lastActionImpactingStatus = await db.db
    .selectFrom('moderation_event')
    .where('id', '<', moderationEvent.refEventId)
    .where('subjectType', '=', moderationEvent.subjectType)
    .where('subjectCid', '=', moderationEvent.subjectCid)
    .where('subjectDid', '=', moderationEvent.subjectDid)
    .where('subjectUri', '=', moderationEvent.subjectUri)
    .where('action', '!=', REVERT)
    .where(
      'action',
      'in',
      // TODO: wait, why doesn't TS like this? this is string[] right?
      // @ts-ignore
      actionTypesImpactingStatus,
    )
    // Make sure we get the last action event that impacted the status
    .orderBy('id', 'desc')
    .select('action')
    .executeTakeFirst()

  return lastActionImpactingStatus
}
