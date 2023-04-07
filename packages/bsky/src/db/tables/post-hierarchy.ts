export const tableName = 'post_hierarchy'

export interface PostHierarchy {
  uri: string
  ancestorUri: string
  depth: number
}

export type PartialDB = {
  [tableName]: PostHierarchy
}
