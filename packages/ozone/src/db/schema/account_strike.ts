export const accountStrikeTableName = 'account_strike'

export interface AccountStrike {
  did: string // Primary key
  firstStrikeAt: string | null
  lastStrikeAt: string | null
  activeStrikeCount: number
  totalStrikeCount: number
}

export type PartialDB = {
  [accountStrikeTableName]: AccountStrike
}
