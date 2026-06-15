import { HydrationMap, ItemRef } from './util'

export type Post = {
  uri: string
  cid: string
  creator: string
  caption?: string
  mediaType?: string
  mediaJson?: unknown
  likeCount: number
  createdAt: string
  indexedAt: string
}

export type Posts = HydrationMap<Post>

export type PostViewerState = {
  like?: string
}

export type PostViewerStates = HydrationMap<PostViewerState>

export type FeedItem = {
  post: ItemRef
}
