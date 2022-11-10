import { Generated } from 'kysely'

export interface MessageQueue {
  id: Generated<number>
  message: string
  read: 0 | 1
  createdAt: string
}

export const viewName = 'message_queue'

export type PartialDB = { [viewName]: MessageQueue }
