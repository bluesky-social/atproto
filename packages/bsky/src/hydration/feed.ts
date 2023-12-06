import { DataPlaneClient } from '../data-plane/client'
import { Record as PostRecord } from '../lexicon/types/app/bsky/feed/post'
import { Record as FeedGenRecord } from '../lexicon/types/app/bsky/feed/generator'
import { Record as ThreadgateRecord } from '../lexicon/types/app/bsky/feed/threadgate'
import { HydrationMap } from './util'

export type Post = PostRecord
export type Posts = HydrationMap<Post>

export type PostViewerState = {
  muted?: boolean
  mutedByList?: string
  blockedBy?: boolean
  blocking?: string
  blockingByList?: string
  following?: string
  followedBy?: string
}

export type PostViewerStates = Map<string, PostViewerState | null>

export type PostAgg = {
  followers: number
  follows: number
  posts: number
}

export type PostAggs = Map<string, PostAgg | null>

export type FeedGen = FeedGenRecord
export type FeedGens = HydrationMap<FeedGen>

export type Threadgate = ThreadgateRecord
export type Threadgates = HydrationMap<Threadgate>

export class FeedHydrator {
  constructor(public dataplane: DataPlaneClient) {}

  async getPosts(uris: string[]): Promise<Posts> {
    throw new Error('unimplemented')
  }

  async getPostViewerStates(
    uris: string[],
    viewer: string,
  ): Promise<PostViewerStates> {
    throw new Error('unimplemented')
  }

  async getPostAggregates(uris: string[]): Promise<PostAggs> {
    throw new Error('unimplemented')
  }

  async getFeedGens(uris: string[]): Promise<FeedGens> {
    throw new Error('unimplemented')
  }

  async getThreadgatesForPosts(postUris: string[]): Promise<Threadgates> {
    throw new Error('unimplemented')
  }
}
