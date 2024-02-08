export interface PlivoSession {
  phoneNumber: string
  sessionId: string
  createdAt: string
}

export const tableName = 'plivo_session'

export type PartialDB = { [tableName]: PlivoSession }
