import { DatetimeString, DidString } from '@atproto/lex'

export interface InviteCode {
  code: string
  availableUses: number
  disabled: 0 | 1
  forAccount: string
  createdBy: string
  createdAt: DatetimeString
}

export interface InviteCodeUse {
  code: string
  usedBy: DidString
  usedAt: DatetimeString
}

export const tableName = 'invite_code'
export const supportingTableName = 'invite_code_use'

export type PartialDB = {
  [tableName]: InviteCode
  [supportingTableName]: InviteCodeUse
}
