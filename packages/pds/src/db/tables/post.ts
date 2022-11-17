export const tableName = 'post'

export interface Post {
  uri: string
  cid: string
  creator: string
  text: string
  replyRoot: string | null
  replyRootCid: string | null
  replyParent: string | null
  replyParentCid: string | null
  createdAt: string
  indexedAt: string
}

export const supportingTableName = 'post_entity'
export interface PostEntity {
  postUri: string
  startIndex: number
  endIndex: number
  type: string
  value: string
}

export type PartialDB = {
  [tableName]: Post
  [supportingTableName]: PostEntity
}
