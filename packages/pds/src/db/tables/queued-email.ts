export interface QueuedEmail {
  email: string
  registeredAt: string
  lastEmailed: string | null
}

export const tableName = 'queued_email'

export type PartialDB = {
  [tableName]: QueuedEmail
}
