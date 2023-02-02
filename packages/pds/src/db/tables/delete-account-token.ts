export interface DeleteAccountToken {
  did: string
  token: string
  requestedAt: string
}

export const tableName = 'delete_account_token'

export type PartialDB = { [tableName]: DeleteAccountToken }
