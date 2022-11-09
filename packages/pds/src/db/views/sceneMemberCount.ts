export interface SceneMemberCount {
  did: string
  count: number
}

export const viewName = 'scene_member_count'

export type PartialDB = { [viewName]: SceneMemberCount }
