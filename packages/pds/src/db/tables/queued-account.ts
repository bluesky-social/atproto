export interface QueuedAccount {
  did: string
  activatedAt: string | null
}

export const tableName = 'queued_account'

export type PartialDB = {
  [tableName]: QueuedAccount
}
