import {
  type DatetimeString,
  type DidString,
  currentDatetimeString,
} from '@atproto/lex'
import type { StrikeSuspensionConfig } from '../config/strike-suspension.js'
import type { Database } from '../db/index.js'

export type Standing = 'good' | 'warning' | 'atRisk'

export type AccountStanding = {
  standing: Standing
  updatedAt: DatetimeString
  expiresAt?: DatetimeString
}

/** Shared derivation for account status and standing notifications. */
export async function getAccountStanding(
  db: Database,
  did: DidString,
  config: StrikeSuspensionConfig,
): Promise<AccountStanding> {
  const [status, strike] = await Promise.all([
    db.db
      .selectFrom('moderation_subject_status')
      .where('did', '=', did)
      .where('recordPath', '=', '')
      .where('convoId', '=', '')
      .select([
        'takendown',
        'suspendUntil',
        'muteUntil',
        'muteReportingUntil',
        'updatedAt',
      ])
      .executeTakeFirst(),
    db.db
      .selectFrom('account_strike')
      .where('did', '=', did)
      .select(['activeStrikeCount', 'lastStrikeAt'])
      .executeTakeFirst(),
  ])
  const now = currentDatetimeString()
  const count = strike?.activeStrikeCount ?? 0
  const thresholds = Object.keys(config)
    .map(Number)
    .sort((a, b) => a - b)
  // @NOTE The first suspension tier does not affect inbox standing.
  const warningThreshold = thresholds[1] ?? Infinity
  const atRiskThreshold = thresholds[2] ?? Infinity
  const suspended = !!status?.suspendUntil && status.suspendUntil > now
  const restricted =
    (!!status?.muteUntil && status.muteUntil > now) ||
    (!!status?.muteReportingUntil && status.muteReportingUntil > now)
  const standing =
    status?.takendown || suspended || count >= atRiskThreshold
      ? 'atRisk'
      : restricted || count >= warningThreshold
        ? 'warning'
        : 'good'
  const updatedAt =
    status?.updatedAt && strike?.lastStrikeAt
      ? status.updatedAt > strike.lastStrikeAt
        ? status.updatedAt
        : strike.lastStrikeAt
      : (status?.updatedAt ??
        strike?.lastStrikeAt ??
        '1970-01-01T00:00:00.000Z')
  return {
    standing,
    updatedAt,
    ...(suspended && status?.suspendUntil
      ? { expiresAt: status.suspendUntil }
      : {}),
  }
}
