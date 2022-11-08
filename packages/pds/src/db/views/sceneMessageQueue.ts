export interface SceneMessageQueue {
  did: string
  count: number
}

export const viewName = 'scene_message_queue'

export type PartialDB = { [viewName]: SceneMessageQueue }
