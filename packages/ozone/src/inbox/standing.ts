import { type DidString, currentDatetimeString } from '@atproto/lex'
import type { Database } from '../db/index.js'

export type Standing = 'good' | 'warning' | 'atRisk'

/** Keep this derivation aligned with getAccountStatus. */
export async function getInboxStanding(
  db: Database,
  did: DidString,
): Promise<Standing> {
  const [status, strike] = await Promise.all([
    db.db
      .selectFrom('moderation_subject_status')
      .where('did', '=', did)
      .where('recordPath', '=', '')
      .where('convoId', '=', '')
      .select(['takendown', 'suspendUntil', 'muteUntil', 'muteReportingUntil'])
      .executeTakeFirst(),
    db.db
      .selectFrom('account_strike')
      .where('did', '=', did)
      .select('activeStrikeCount')
      .executeTakeFirst(),
  ])
  const now = currentDatetimeString()
  const count = strike?.activeStrikeCount ?? 0
  if (
    status?.takendown ||
    (status?.suspendUntil && status.suspendUntil > now) ||
    count >= 12
  )
    return 'atRisk'
  if (
    (status?.muteUntil && status.muteUntil > now) ||
    (status?.muteReportingUntil && status.muteReportingUntil > now) ||
    count >= 8
  )
    return 'warning'
  return 'good'
}
