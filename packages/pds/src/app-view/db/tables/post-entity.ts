export const tableName = 'post_entity'
export interface PostEntity {
  postUri: string
  startIndex: number
  endIndex: number
  type: string
  value: string
}

export type PartialDB = {
  [tableName]: PostEntity
}
