export interface SceneLikesOnPost {
  did: string
  subject: string
  direction: string
  count: number
}

export const viewName = 'scene_likes_on_post'

export type PartialDB = { [viewName]: SceneLikesOnPost }
