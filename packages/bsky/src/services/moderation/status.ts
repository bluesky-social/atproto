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
} from '../../lexicon/types/com/atproto/admin/defs'

// TODO: How do we handle revert? for "revert" event we will have a reference event id that is being reversed
// We will probably need a helper that can take a list of events and compute the final state of the subject
// That helper will have to be invoked here with all events up until the point where the reverted event was created
const getSubjectStatusForModerationAction = (action: string) => {
  switch (action) {
    case ACKNOWLEDGE:
      return ACKNOWLEDGED
    case REPORT:
      return REPORTED
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
    'action' | 'subjectType' | 'subjectDid' | 'subjectUri' | 'subjectCid'
  >,
) => {
  const { action, subjectType, subjectDid, subjectUri, subjectCid } =
    moderationAction

  const status = getSubjectStatusForModerationAction(action)

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
