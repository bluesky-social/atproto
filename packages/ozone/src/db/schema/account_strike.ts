import type { DatetimeString, DidString } from '@atproto/lex'
export const accountStrikeTableName = 'account_strike'

export interface AccountStrike {
  did: DidString // Primary key
  firstStrikeAt: DatetimeString | null
  lastStrikeAt: DatetimeString | null
  activeStrikeCount: number
  totalStrikeCount: number
}

export type PartialDB = {
  [accountStrikeTableName]: AccountStrike
}
