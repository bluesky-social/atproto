import { Generated } from 'kysely'

export interface MessageQueue {
  id: Generated<number>
  message: string
  createdAt: string
}

export const viewName = 'message_queue'

export type PartialDB = { [viewName]: MessageQueue }
