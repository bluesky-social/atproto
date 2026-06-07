export const tableName = 'post'

export interface Post {
  uri: string
  cid: string
  creator: string
  caption: string | null
  mediaType: string | null
  mediaJson: unknown | null
  likeCount: number
  createdAt: string
  indexedAt: string
}

export type PartialDB = { [tableName]: Post }
