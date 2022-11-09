export interface SceneVotesOnPost {
  did: string
  subject: string
  count: number
}

export const viewName = 'scene_votes_on_post'

export type PartialDB = { [viewName]: SceneVotesOnPost }
