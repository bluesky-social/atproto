export const tableName = 'post_facet'
export interface PostFacet {
  postUri: string
  startIndex: number
  endIndex: number
  type: 'mention' | 'link'
  value: string
}

export type PartialDB = {
  [tableName]: PostFacet
}
