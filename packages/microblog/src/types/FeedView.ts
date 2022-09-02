export interface Params {
  author?: string
  limit?: number
  before?: string
}

export interface Response {
  feed: FeedItem[]
}
export interface FeedItem {
  uri: string
  author: User
  repostedBy?: User
  record: {} //@TODO i dont think this got parsed correctly
  embed?: RecordEmbed | ExternalEmbed | UnknownEmbed
  replyCount: number
  repostCount: number
  likeCount: number
  indexedAt: string
  myState?: {
    hasReposted: boolean
    hasLiked: boolean
  }
}
export interface User {
  did: string
  name: string
  displayName: string
}
export interface RecordEmbed {
  type: 'record'
  author: User
  record: {}
}
export interface ExternalEmbed {
  type: 'external'
  uri: string
  title: string
  description: string
  imageUri: string
}
export interface UnknownEmbed {
  type: string
}
