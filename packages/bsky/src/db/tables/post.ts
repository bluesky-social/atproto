import { Generated } from 'kysely'

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
  likeCount: Generated<number>
  replyCount: Generated<number>
  repostCount: Generated<number>
  createdAt: string
  indexedAt: string
}

export type PartialDB = {
  [tableName]: Post
}
