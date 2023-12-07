import { DataPlaneClient } from '../data-plane/client'
import { Record as PostRecord } from '../lexicon/types/app/bsky/feed/post'
import { Record as LikeRecord } from '../lexicon/types/app/bsky/feed/like'
import { Record as FeedGenRecord } from '../lexicon/types/app/bsky/feed/generator'
import { Record as ThreadgateRecord } from '../lexicon/types/app/bsky/feed/threadgate'
import { HydrationMap } from './util'

export type Post = PostRecord
export type Posts = HydrationMap<Post>

export type PostViewerState = {
  like?: string
}

export type PostViewerStates = HydrationMap<PostViewerState>

export type PostAgg = {
  likes: number
  replies: number
  reposts: number
}

export type PostAggs = HydrationMap<PostAgg>

export type Like = LikeRecord
export type Likes = HydrationMap<Like>

export type FeedGenAgg = {
  likes: number
}

export type FeedGenAggs = HydrationMap<FeedGenAgg>

export type FeedGen = FeedGenRecord
export type FeedGens = HydrationMap<FeedGen>

export type FeedGenViewerState = {
  like?: string
}

export type FeedGenViewerStates = HydrationMap<FeedGenViewerState>

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

  async getFeedGenViewerStates(
    uris: string[],
    viewer: string,
  ): Promise<FeedGenViewerStates> {
    throw new Error('unimplemented')
  }

  async getFeedGenAggregates(uris: string[]): Promise<FeedGenAggs> {
    throw new Error('unimplemented')
  }

  async getThreadgatesForPosts(postUris: string[]): Promise<Threadgates> {
    throw new Error('unimplemented')
  }

  // @TODO may not be supported yet by data plane
  async getLikes(uris: string[]): Promise<Likes> {
    throw new Error('unimplemented')
  }
}
