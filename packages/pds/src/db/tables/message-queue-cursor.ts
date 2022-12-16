export interface MessageQueueCursor {
  consumer: string
  topic: string
  cursor: number
}

export const viewName = 'message_queue_cursor'

export type PartialDB = { [viewName]: MessageQueueCursor }
