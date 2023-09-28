// This may require better organization but for now, just dumping functions here containing DB queries for moderation status

import { PrimaryDatabase } from '../../db'
import {
  ModerationAction,
  ModerationSubjectStatus,
} from '../../db/tables/moderation'
import {
  ACKNOWLEDGE,
  ACKNOWLEDGED,
  MUTE,
  MUTED,
  REPORT,
  REPORTED,
  REVERT,
  TAKEDOWN,
  TAKENDOWN,
  ESCALATED,
  ESCALATE,
} from '../../lexicon/types/com/atproto/admin/defs'
import { ModerationActionRow } from './types'

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
const getSubjectStatusForModerationAction = (action: string) => {
  switch (action) {
    case ACKNOWLEDGE:
      return ACKNOWLEDGED
    case REPORT:
      return REPORTED
    case ESCALATE:
      return ESCALATED
    case REVERT:
      return null
    case TAKEDOWN:
      return TAKENDOWN
    case MUTE:
      return MUTED
    default:
      return null
  }
}

// Based on a given moderation action event, this function will update the moderation status of the subject
// If there's no existing status, it will create one
// If the action event does not affect the status, it will do nothing
export const adjustModerationSubjectStatus = async (
  db: PrimaryDatabase,
  moderationAction: Pick<
    ModerationAction,
    | 'action'
    | 'subjectType'
    | 'subjectDid'
    | 'subjectUri'
    | 'subjectCid'
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
  } = moderationAction

  let actionForStatusMapping = action

  // For all events, we would want to map the new status based on the event itself
  // However, for revert events, they will be pointing to a previous event that needs to be reverted
  // In which case, we will have to find out the last event that changed the status before that reference event
  // and compute the new status based on that
  // TODO: We may need more here. For instance, if we're reverting a post takedown but since the takedown, we adjusted
  // labels on the post, does the takedown reversal mean those labels added AFTER the takedown should be reverted as well?
  if (action === REVERT && refEventId) {
    const lastActionImpactingStatus = await getPreviousStatusForReversal(
      db,
      moderationAction,
    )

    if (lastActionImpactingStatus) {
      actionForStatusMapping = lastActionImpactingStatus.action
    }
  }

  const status = getSubjectStatusForModerationAction(actionForStatusMapping)

  if (!status) {
    return null
  }

  const now = new Date().toISOString()
  return db.db
    .insertInto('moderation_subject_status')
    .values({
      status,
      subjectDid,
      subjectType,
      subjectCid,
      subjectUri,
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) =>
      oc.column('status').doUpdateSet({
        status,
        updatedAt: now,
      }),
    )
    .executeTakeFirst()
}

// TODO: The builder probably needs to handle null cases
export const getModerationSubjectStatus = async (
  db: PrimaryDatabase,
  {
    subjectType,
    subjectCid,
    subjectDid,
    subjectUri,
  }: Omit<ModerationSubjectStatus, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
) => {
  return db.db
    .selectFrom('moderation_subject_status')
    .where('subjectType', '=', subjectType)
    .where('subjectCid', '=', subjectCid)
    .where('subjectDid', '=', subjectDid)
    .where('subjectUri', '=', subjectUri)
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
  moderationAction: Pick<
    ModerationActionRow,
    'refEventId' | 'subjectType' | 'subjectCid' | 'subjectUri' | 'subjectDid'
  >,
) => {
  if (!moderationAction.refEventId) {
    return null
  }
  const lastActionImpactingStatus = await db.db
    .selectFrom('moderation_action')
    .where('id', '<', moderationAction.refEventId)
    .where('subjectType', '=', moderationAction.subjectType)
    .where('subjectCid', '=', moderationAction.subjectCid)
    .where('subjectDid', '=', moderationAction.subjectDid)
    .where('subjectUri', '=', moderationAction.subjectUri)
    .where('action', 'not in', REVERT)
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
