import { DataPlaneClient } from '../data-plane/client'
import { Record as PostRecord } from '../lexicon/types/app/bsky/feed/post'
import { Record as LikeRecord } from '../lexicon/types/app/bsky/feed/like'
import { Record as RepostRecord } from '../lexicon/types/app/bsky/feed/repost'
import { Record as FeedGenRecord } from '../lexicon/types/app/bsky/feed/generator'
import { Record as ThreadgateRecord } from '../lexicon/types/app/bsky/feed/threadgate'
import {
  HydrationMap,
  RecordInfo,
  parseRecord,
  parseString,
  split,
} from './util'
import { AtUri } from '@atproto/syntax'
import { ids } from '../lexicon/lexicons'

export type Post = RecordInfo<PostRecord> & { violatesThreadGate: boolean }
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

export type ItemRef = { uri: string; cid?: string }

// @NOTE the feed item types in the protos for author feeds and timelines
// technically have additional fields, not supported by the mock dataplane.
export type FeedItem = { post: ItemRef; repost?: ItemRef }

export class FeedHydrator {
  constructor(public dataplane: DataPlaneClient) {}

  async getPosts(
    uris: string[],
    includeTakedowns = false,
    given = new HydrationMap<Post>(),
  ): Promise<Posts> {
    const [have, need] = split(uris, (uri) => given.has(uri))
    const base = have.reduce(
      (acc, uri) => acc.set(uri, given.get(uri) ?? null),
      new HydrationMap<Post>(),
    )
    if (!need.length) return base
    const res = await this.dataplane.getPostRecords({ uris: need })
    return need.reduce((acc, uri, i) => {
      const record = parseRecord<PostRecord>(res.records[i], includeTakedowns)
      const violatesThreadGate = res.meta[i].violatesThreadGate
      return acc.set(uri, record ? { ...record, violatesThreadGate } : null)
    }, base)
  }

  async getPostViewerStates(
    refs: ItemRef[],
    viewer: string,
  ): Promise<PostViewerStates> {
    if (!refs.length) return new HydrationMap<PostViewerState>()
    const [likes, reposts] = await Promise.all([
      this.dataplane.getLikesByActorAndSubjects({
        actorDid: viewer,
        refs,
      }),
      this.dataplane.getRepostsByActorAndSubjects({
        actorDid: viewer,
        refs,
      }),
    ])
    return refs.reduce((acc, { uri }, i) => {
      return acc.set(uri, {
        like: parseString(likes.uris[i]),
        repost: parseString(reposts.uris[i]),
      })
    }, new HydrationMap<PostViewerState>())
  }

  async getPostAggregates(refs: ItemRef[]): Promise<PostAggs> {
    if (!refs.length) return new HydrationMap<PostAgg>()
    const counts = await this.dataplane.getInteractionCounts({ refs })
    return refs.reduce((acc, { uri }, i) => {
      return acc.set(uri, {
        likes: counts.likes[i] ?? 0,
        reposts: counts.reposts[i] ?? 0,
        replies: counts.replies[i] ?? 0,
      })
    }, new HydrationMap<PostAgg>())
  }

  async getFeedGens(
    uris: string[],
    includeTakedowns = false,
  ): Promise<FeedGens> {
    if (!uris.length) return new HydrationMap<FeedGen>()
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
    if (!uris.length) return new HydrationMap<FeedGenViewerState>()
    const likes = await this.dataplane.getLikesByActorAndSubjects({
      actorDid: viewer,
      refs: uris.map((uri) => ({ uri })),
    })
    return uris.reduce((acc, uri, i) => {
      return acc.set(uri, {
        like: parseString(likes.uris[i]),
      })
    }, new HydrationMap<FeedGenViewerState>())
  }

  async getFeedGenAggregates(refs: ItemRef[]): Promise<FeedGenAggs> {
    if (!refs.length) return new HydrationMap<FeedGenAgg>()
    const counts = await this.dataplane.getInteractionCounts({ refs })
    return refs.reduce((acc, { uri }, i) => {
      return acc.set(uri, {
        likes: counts.likes[i] ?? 0,
      })
    }, new HydrationMap<FeedGenAgg>())
  }

  async getThreadgatesForPosts(
    postUris: string[],
    includeTakedowns = false,
  ): Promise<Threadgates> {
    if (!postUris.length) return new HydrationMap<Threadgate>()
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
    if (!uris.length) return new HydrationMap<Like>()
    const res = await this.dataplane.getLikeRecords({ uris })
    return uris.reduce((acc, uri, i) => {
      const record = parseRecord<LikeRecord>(res.records[i], includeTakedowns)
      return acc.set(uri, record ?? null)
    }, new HydrationMap<Like>())
  }

  async getReposts(uris: string[], includeTakedowns = false): Promise<Reposts> {
    if (!uris.length) return new HydrationMap<Repost>()
    const res = await this.dataplane.getRepostRecords({ uris })
    return uris.reduce((acc, uri, i) => {
      const record = parseRecord<RepostRecord>(res.records[i], includeTakedowns)
      return acc.set(uri, record ?? null)
    }, new HydrationMap<Repost>())
  }
}
