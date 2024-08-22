import { GeneratedAlways } from 'kysely'

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
  langs: string[] | null
  tags: string[] | null
  invalidReplyRoot: boolean | null
  violatesThreadGate: boolean | null
  violatesEmbeddingRules: boolean | null
  hasThreadGate: boolean | null
  hasPostGate: boolean | null
  createdAt: string
  indexedAt: string
  sortAt: GeneratedAlways<string>
}

export type PartialDB = {
  [tableName]: Post
}
