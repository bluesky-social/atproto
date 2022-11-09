import { Generated } from 'kysely'

export interface SceneMessageQueue {
  id: Generated<number>
  message: string
  read: 0 | 1
  createdAt: string
}

export const viewName = 'scene_message_queue'

export type PartialDB = { [viewName]: SceneMessageQueue }
