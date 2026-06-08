import { Generated } from 'kysely'

export const tableName = 'post'

export interface Post {
  uri: string
  cid: string
  creator: string
  caption: string | null
  mediaType: string | null
  mediaJson: unknown | null
  // Generated<> = Postgres DEFAULT 0 on insert; reads still return plain number.
  likeCount: Generated<number>
  createdAt: string
  indexedAt: string
}

export type PartialDB = { [tableName]: Post }
