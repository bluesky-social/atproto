import { DataPlaneClient } from '../data-plane/client'
import { Record as PostRecord } from '../lexicon/types/app/bsky/feed/post'
import { Record as LikeRecord } from '../lexicon/types/app/bsky/feed/like'
import { Record as RepostRecord } from '../lexicon/types/app/bsky/feed/repost'
import { Record as FeedGenRecord } from '../lexicon/types/app/bsky/feed/generator'
import { Record as ThreadgateRecord } from '../lexicon/types/app/bsky/feed/threadgate'
import { HydrationMap, RecordInfo, parseRecord, parseString } from './util'
import { AtUri } from '@atproto/syntax'
import { ids } from '../lexicon/lexicons'

export type Post = RecordInfo<PostRecord>
export type Posts = HydrationMap<Post>

export type PostViewerState = {
  like?: string
  repost?: string
}

export type PostViewerStates = HydrationMap<PostViewerState>

export type PostAgg = {
  likes: number
  replies: number
  reposts: number
}

export type PostAggs = HydrationMap<PostAgg>

export type Like = RecordInfo<LikeRecord>
export type Likes = HydrationMap<Like>

export type Repost = RecordInfo<RepostRecord>
export type Reposts = HydrationMap<Repost>

export type FeedGenAgg = {
  likes: number
}

export type FeedGenAggs = HydrationMap<FeedGenAgg>

export type FeedGen = RecordInfo<FeedGenRecord>
export type FeedGens = HydrationMap<FeedGen>

export type FeedGenViewerState = {
  like?: string
}

export type FeedGenViewerStates = HydrationMap<FeedGenViewerState>

export type Threadgate = RecordInfo<ThreadgateRecord>
export type Threadgates = HydrationMap<Threadgate>

export class FeedHydrator {
  constructor(public dataplane: DataPlaneClient) {}

  async getPosts(uris: string[], includeTakedowns = false): Promise<Posts> {
    const res = await this.dataplane.getPostRecords({ uris })
    return uris.reduce((acc, uri, i) => {
      const record = parseRecord<PostRecord>(res.records[i], includeTakedowns)
      return acc.set(uri, record ?? null)
    }, new HydrationMap<Post>())
  }

  async getPostViewerStates(
    uris: string[],
    viewer: string,
  ): Promise<PostViewerStates> {
    const [likes, reposts] = await Promise.all([
      this.dataplane.getLikesByActorAndSubjects({
        actorDid: viewer,
        subjectUris: uris,
      }),
      this.dataplane.getRepostsByActorAndSubjects({
        actorDid: viewer,
        subjectUris: uris,
      }),
    ])
    return uris.reduce((acc, uri, i) => {
      return acc.set(uri, {
        like: parseString(likes.uris[i]),
        repost: parseString(reposts.uris[i]),
      })
    }, new HydrationMap<PostViewerState>())
  }

  async getPostAggregates(uris: string[]): Promise<PostAggs> {
    const [likes, reposts, replies] = await Promise.all([
      this.dataplane.getLikeCounts({ uris }),
      this.dataplane.getRepostCounts({ uris }),
      this.dataplane.getPostReplyCounts({ uris }),
    ])
    return uris.reduce((acc, uri, i) => {
      return acc.set(uri, {
        likes: likes.counts[i] ?? 0,
        reposts: reposts.counts[i] ?? 0,
        replies: replies.counts[i] ?? 0,
      })
    }, new HydrationMap<PostAgg>())
  }

  async getFeedGens(
    uris: string[],
    includeTakedowns = false,
  ): Promise<FeedGens> {
    const res = await this.dataplane.getFeedGeneratorRecords({ uris })
    return uris.reduce((acc, uri, i) => {
      const record = parseRecord<FeedGenRecord>(
        res.records[i],
        includeTakedowns,
      )
      return acc.set(uri, record ?? null)
    }, new HydrationMap<FeedGen>())
  }

  async getFeedGenViewerStates(
    uris: string[],
    viewer: string,
  ): Promise<FeedGenViewerStates> {
    const likes = await this.dataplane.getLikesByActorAndSubjects({
      actorDid: viewer,
      subjectUris: uris,
    })
    return uris.reduce((acc, uri, i) => {
      return acc.set(uri, {
        like: parseString(likes.uris[i]),
      })
    }, new HydrationMap<FeedGenViewerState>())
  }

  async getFeedGenAggregates(uris: string[]): Promise<FeedGenAggs> {
    const likes = await this.dataplane.getLikeCounts({ uris })
    return uris.reduce((acc, uri, i) => {
      return acc.set(uri, {
        likes: likes.counts[i] ?? 0,
      })
    }, new HydrationMap<FeedGenAgg>())
  }

  async getThreadgatesForPosts(
    postUris: string[],
    includeTakedowns = false,
  ): Promise<Threadgates> {
    const uris = postUris.map((uri) => {
      const parsed = new AtUri(uri)
      return AtUri.make(
        parsed.hostname,
        ids.AppBskyFeedThreadgate,
        parsed.rkey,
      ).toString()
    })
    const res = await this.dataplane.getThreadGateRecords({ uris })
    return uris.reduce((acc, uri, i) => {
      const record = parseRecord<ThreadgateRecord>(
        res.records[i],
        includeTakedowns,
      )
      return acc.set(uri, record ?? null)
    }, new HydrationMap<Threadgate>())
  }

  // @TODO may not be supported yet by data plane
  async getLikes(uris: string[], includeTakedowns = false): Promise<Likes> {
    const res = await this.dataplane.getLikeRecords({ uris })
    return uris.reduce((acc, uri, i) => {
      const record = parseRecord<LikeRecord>(res.records[i], includeTakedowns)
      return acc.set(uri, record ?? null)
    }, new HydrationMap<Like>())
  }

  async getReposts(uris: string[], includeTakedowns = false): Promise<Reposts> {
    const res = await this.dataplane.getRepostRecords({ uris })
    return uris.reduce((acc, uri, i) => {
      const record = parseRecord<RepostRecord>(res.records[i], includeTakedowns)
      return acc.set(uri, record ?? null)
    }, new HydrationMap<Repost>())
  }
}
