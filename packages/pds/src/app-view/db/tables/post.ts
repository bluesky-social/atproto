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
  // string is a json-serialized array for sqlite, string[] is jsonb for postgres, null is empty
  langs: string | string[] | null
  createdAt: string
  indexedAt: string
}

export type PartialDB = {
  [tableName]: Post
}
