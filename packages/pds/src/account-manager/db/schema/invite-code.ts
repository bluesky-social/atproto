export interface InviteCode {
  code: string
  availableUses: number
  disabled: 0 | 1
  forAccount: string
  createdBy: string
  createdAt: string
}

export interface InviteCodeUse {
  code: string
  usedBy: string
  usedAt: string
}

export const tableName = 'invite_code'
export const supportingTableName = 'invite_code_use'

export type PartialDB = {
  [tableName]: InviteCode
  [supportingTableName]: InviteCodeUse
}
