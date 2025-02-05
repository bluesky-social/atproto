import { dedupeStrs } from '@atproto/common'
import { DataPlaneClient } from '../data-plane/client'
import { Record as FeedGenRecord } from '../lexicon/types/app/bsky/feed/generator'
import { Record as LikeRecord } from '../lexicon/types/app/bsky/feed/like'
import { Record as PostRecord } from '../lexicon/types/app/bsky/feed/post'
import { Record as PostgateRecord } from '../lexicon/types/app/bsky/feed/postgate'
import { Record as RepostRecord } from '../lexicon/types/app/bsky/feed/repost'
import { Record as ThreadgateRecord } from '../lexicon/types/app/bsky/feed/threadgate'
import {
  postUriToPostgateUri,
  postUriToThreadgateUri,
  uriToDid as didFromUri,
} from '../util/uris'
import {
  HydrationMap,
  ItemRef,
  RecordInfo,
  parseRecord,
  parseString,
  split,
} from './util'

export type Post = RecordInfo<PostRecord> & {
  violatesThreadGate: boolean
  violatesEmbeddingRules: boolean
  hasThreadGate: boolean
  hasPostGate: boolean
}
export type Posts = HydrationMap<Post>

export type PostViewerState = {
  like?: string
  repost?: string
  threadMuted?: boolean
}

export type PostViewerStates = HydrationMap<PostViewerState>

export type ThreadContext = {
  like?: string
}

export type ThreadContexts = HydrationMap<ThreadContext>

export type PostAgg = {
  likes: number
  replies: number
  reposts: number
  quotes: number
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
export type Postgate = RecordInfo<PostgateRecord>
export type Postgates = HydrationMap<Postgate>

export type ThreadRef = ItemRef & { threadRoot: string }

// @NOTE the feed item types in the protos for author feeds and timelines
// technically have additional fields, not supported by the mock dataplane.
export type FeedItem = {
  post: ItemRef
  repost?: ItemRef
  /**
   * If true, overrides the `reason` with `app.bsky.feed.defs#reasonPin`. Used
   * only in author feeds.
   */
  authorPinned?: boolean
}

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
      const violatesEmbeddingRules = res.meta[i].violatesEmbeddingRules
      const hasThreadGate = res.meta[i].hasThreadGate
      const hasPostGate = res.meta[i].hasPostGate
      return acc.set(
        uri,
        record
          ? {
              ...record,
              violatesThreadGate,
              violatesEmbeddingRules,
              hasThreadGate,
              hasPostGate,
            }
          : null,
      )
    }, base)
  }

  async getPostViewerStates(
    refs: ThreadRef[],
    viewer: string,
  ): Promise<PostViewerStates> {
    if (!refs.length) return new HydrationMap<PostViewerState>()
    const threadRoots = refs.map((r) => r.threadRoot)
    const [likes, reposts, threadMutesMap] = await Promise.all([
      this.dataplane.getLikesByActorAndSubjects({
        actorDid: viewer,
        refs,
      }),
      this.dataplane.getRepostsByActorAndSubjects({
        actorDid: viewer,
        refs,
      }),
      this.getThreadMutes(threadRoots, viewer),
    ])
    return refs.reduce((acc, { uri, threadRoot }, i) => {
      return acc.set(uri, {
        like: parseString(likes.uris[i]),
        repost: parseString(reposts.uris[i]),
        threadMuted: threadMutesMap.get(threadRoot) ?? false,
      })
    }, new HydrationMap<PostViewerState>())
  }

  private async getThreadMutes(
    threadRoots: string[],
    viewer: string,
  ): Promise<Map<string, boolean>> {
    const deduped = dedupeStrs(threadRoots)
    const threadMutes = await this.dataplane.getThreadMutesOnSubjects({
      actorDid: viewer,
      threadRoots: deduped,
    })
    return deduped.reduce((acc, cur, i) => {
      return acc.set(cur, threadMutes.muted[i] ?? false)
    }, new Map<string, boolean>())
  }

  async getThreadContexts(refs: ThreadRef[]): Promise<ThreadContexts> {
    if (!refs.length) return new HydrationMap<ThreadContext>()

    const refsByRootAuthor = refs.reduce((acc, ref) => {
      const { threadRoot } = ref
      const rootAuthor = didFromUri(threadRoot)
      const existingValue = acc.get(rootAuthor) ?? []
      return acc.set(rootAuthor, [...existingValue, ref])
    }, new Map<string, ThreadRef[]>())
    const refsByRootAuthorEntries = Array.from(refsByRootAuthor.entries())

    const likesPromises = refsByRootAuthorEntries.map(
      ([rootAuthor, refsForAuthor]) =>
        this.dataplane.getLikesByActorAndSubjects({
          actorDid: rootAuthor,
          refs: refsForAuthor.map(({ uri, cid }) => ({ uri, cid })),
        }),
    )

    const rootAuthorsLikes = await Promise.all(likesPromises)

    const likesByUri = refsByRootAuthorEntries.reduce(
      (acc, [_rootAuthor, refsForAuthor], i) => {
        const likesForRootAuthor = rootAuthorsLikes[i]
        refsForAuthor.forEach(({ uri }, j) => {
          acc.set(uri, likesForRootAuthor.uris[j])
        })
        return acc
      },
      new Map<string, string>(),
    )

    return refs.reduce((acc, { uri }) => {
      return acc.set(uri, {
        like: parseString(likesByUri.get(uri)),
      })
    }, new HydrationMap<ThreadContext>())
  }

  async getPostAggregates(refs: ItemRef[]): Promise<PostAggs> {
    if (!refs.length) return new HydrationMap<PostAgg>()
    const counts = await this.dataplane.getInteractionCounts({ refs })
    return refs.reduce((acc, { uri }, i) => {
      return acc.set(uri, {
        likes: counts.likes[i] ?? 0,
        reposts: counts.reposts[i] ?? 0,
        replies: counts.replies[i] ?? 0,
        quotes: counts.quotes[i] ?? 0,
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
    const uris = postUris.map(postUriToThreadgateUri)
    return this.getThreadgateRecords(uris, includeTakedowns)
  }

  async getThreadgateRecords(
    uris: string[],
    includeTakedowns = false,
  ): Promise<Threadgates> {
    const res = await this.dataplane.getThreadGateRecords({ uris })
    return uris.reduce((acc, uri, i) => {
      const record = parseRecord<ThreadgateRecord>(
        res.records[i],
        includeTakedowns,
      )
      return acc.set(uri, record ?? null)
    }, new HydrationMap<Threadgate>())
  }

  async getPostgatesForPosts(
    postUris: string[],
    includeTakedowns = false,
  ): Promise<Postgates> {
    if (!postUris.length) return new HydrationMap<Postgate>()
    const uris = postUris.map(postUriToPostgateUri)
    return this.getPostgateRecords(uris, includeTakedowns)
  }

  async getPostgateRecords(
    uris: string[],
    includeTakedowns = false,
  ): Promise<Postgates> {
    const res = await this.dataplane.getPostgateRecords({ uris })
    return uris.reduce((acc, uri, i) => {
      const record = parseRecord<PostgateRecord>(
        res.records[i],
        includeTakedowns,
      )
      return acc.set(uri, record ?? null)
    }, new HydrationMap<Postgate>())
  }

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
