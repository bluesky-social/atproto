import { dedupeStrs } from '@atproto/common'
import { AtUriString, DidString } from '@atproto/syntax'
import { DataPlaneClient } from '../data-plane/client'
import {
  postUriToPostgateUri,
  postUriToThreadgateUri,
  uriToDid as didFromUri,
} from '../util/uris'
import {
  FeedGenRecord,
  GateRecord,
  LikeRecord,
  PostRecord,
  PostgateRecord,
  RepostRecord,
} from '../views/types.js'
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
  tags: Set<string>
  /**
   * Debug information for internal development
   */
  debug?: {
    tags?: string[]
  }
}

export type Posts = HydrationMap<Post, AtUriString>

export type PostViewerState = {
  like?: AtUriString
  repost?: AtUriString
  bookmarked?: boolean
  threadMuted?: boolean
}

export type PostViewerStates = HydrationMap<PostViewerState, AtUriString>

export type ThreadContext = {
  // Whether the root author has liked the post.
  like?: AtUriString
}

export type ThreadContexts = HydrationMap<ThreadContext, AtUriString>

export type PostAgg = {
  likes: number
  replies: number
  reposts: number
  quotes: number
  bookmarks: number
}

export type PostAggs = HydrationMap<PostAgg, AtUriString>

export type Like = RecordInfo<LikeRecord>
export type Likes = HydrationMap<Like, AtUriString>

export type Repost = RecordInfo<RepostRecord>
export type Reposts = HydrationMap<Repost, AtUriString>

export type FeedGenAgg = {
  likes: number
}

export type FeedGenAggs = HydrationMap<FeedGenAgg, AtUriString>

export type FeedGen = RecordInfo<FeedGenRecord>
export type FeedGens = HydrationMap<FeedGen, AtUriString>

export type FeedGenViewerState = {
  like?: AtUriString
}

export type FeedGenViewerStates = HydrationMap<FeedGenViewerState, AtUriString>

export type Threadgate = RecordInfo<GateRecord>
export type Threadgates = HydrationMap<Threadgate, AtUriString>
export type Postgate = RecordInfo<PostgateRecord>
export type Postgates = HydrationMap<Postgate, AtUriString>

export type ThreadRef = ItemRef & { threadRoot: AtUriString }

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

export type GetPostsHydrationOptions = {
  processDynamicTagsForView?: 'thread' | 'search'
}

export class FeedHydrator {
  constructor(public dataplane: DataPlaneClient) {}

  async getPosts(
    uris: AtUriString[],
    includeTakedowns = false,
    given: Posts = new HydrationMap(),
    viewer?: string | null,
    options: GetPostsHydrationOptions = {},
  ): Promise<Posts> {
    const [have, need] = split(uris, (uri) => given.has(uri))
    const base: Posts = new HydrationMap()

    for (const uri of have) {
      base.set(uri, given.get(uri) ?? null)
    }

    if (need.length) {
      const res = await this.dataplane.getPostRecords(
        options.processDynamicTagsForView
          ? {
              uris: need,
              viewerDid: viewer ?? undefined,
              processDynamicTagsForView: options.processDynamicTagsForView,
            }
          : {
              uris: need,
            },
      )

      for (let i = 0; i < need.length; i++) {
        const record = parseRecord<PostRecord>(res.records[i], includeTakedowns)
        const violatesThreadGate = res.meta[i].violatesThreadGate
        const violatesEmbeddingRules = res.meta[i].violatesEmbeddingRules
        const hasThreadGate = res.meta[i].hasThreadGate
        const hasPostGate = res.meta[i].hasPostGate
        const tags = new Set<string>(res.records[i].tags ?? [])
        const debug = { tags: Array.from(tags) }

        base.set(
          need[i],
          record
            ? {
                ...record,
                violatesThreadGate,
                violatesEmbeddingRules,
                hasThreadGate,
                hasPostGate,
                tags,
                debug,
              }
            : null,
        )
      }
    }

    return base
  }

  async getPostViewerStates(
    refs: ThreadRef[],
    viewer: string,
  ): Promise<PostViewerStates> {
    const map: PostViewerStates = new HydrationMap()

    if (refs.length) {
      const [likes, reposts, bookmarks, threadMutesMap] = await Promise.all([
        this.dataplane.getLikesByActorAndSubjects({
          actorDid: viewer,
          refs,
        }),
        this.dataplane.getRepostsByActorAndSubjects({
          actorDid: viewer,
          refs,
        }),
        this.dataplane.getBookmarksByActorAndSubjects({
          actorDid: viewer,
          uris: refs.map((r) => r.uri),
        }),
        this.getThreadMutes(
          refs.map((r) => r.threadRoot),
          viewer,
        ),
      ])

      for (let i = 0; i < refs.length; i++) {
        const { uri, threadRoot } = refs[i]
        map.set(uri, {
          like: parseString(likes.uris[i]),
          repost: parseString(reposts.uris[i]),
          // @NOTE: The dataplane contract is that the array position will be present,
          // but the optional chaining is to ensure it works regardless of the dataplane being update to provide the data.
          bookmarked: !!bookmarks.bookmarks.at(i)?.ref?.key,
          threadMuted: threadMutesMap.get(threadRoot) ?? false,
        })
      }
    }

    return map
  }

  private async getThreadMutes(
    threadRoots: AtUriString[],
    viewer: string,
  ): Promise<Map<string, boolean>> {
    const deduped = dedupeStrs(threadRoots)
    const threadMutes = await this.dataplane.getThreadMutesOnSubjects({
      actorDid: viewer,
      threadRoots: deduped,
    })
    const map: Map<AtUriString, boolean> = new Map()
    for (let i = 0; i < deduped.length; i++) {
      map.set(deduped[i], threadMutes.muted[i] ?? false)
    }

    return map
  }

  async getThreadContexts(refs: ThreadRef[]): Promise<ThreadContexts> {
    const map: ThreadContexts = new HydrationMap()

    if (refs.length) {
      const refsByRootAuthor = new Map<DidString, ThreadRef[]>()

      for (const ref of refs) {
        const { threadRoot } = ref
        const rootAuthor = didFromUri(threadRoot)
        const existingValue = refsByRootAuthor.get(rootAuthor) ?? []
        refsByRootAuthor.set(rootAuthor, [...existingValue, ref])
      }

      const refsByRootAuthorEntries = Array.from(refsByRootAuthor.entries())

      const rootAuthorsLikes = await Promise.all(
        refsByRootAuthorEntries.map(([rootAuthor, refsForAuthor]) =>
          this.dataplane.getLikesByActorAndSubjects({
            actorDid: rootAuthor,
            refs: refsForAuthor.map(({ uri, cid }) => ({ uri, cid })),
          }),
        ),
      )

      const likesByUri = new Map<AtUriString, AtUriString>()

      for (let i = 0; i < refsByRootAuthorEntries.length; i++) {
        const [_rootAuthor, refsForAuthor] = refsByRootAuthorEntries[i]
        const likesForRootAuthor = rootAuthorsLikes[i]
        for (let j = 0; j < refsForAuthor.length; j++) {
          const { uri } = refsForAuthor[j]
          likesByUri.set(uri, likesForRootAuthor.uris[j] as AtUriString)
        }
      }

      for (const { uri } of refs) {
        map.set(uri, {
          like: parseString(likesByUri.get(uri)),
        })
      }
    }

    return map
  }

  async getPostAggregates(
    refs: ItemRef[],
    viewer: string | null,
  ): Promise<PostAggs> {
    const map: PostAggs = new HydrationMap()

    if (refs.length) {
      const counts = await this.dataplane.getInteractionCounts({
        refs,
        skipCacheForDids: viewer ? [viewer] : undefined,
      })

      for (let i = 0; i < refs.length; i++) {
        map.set(refs[i].uri, {
          likes: counts.likes[i] ?? 0,
          replies: counts.replies[i] ?? 0,
          reposts: counts.reposts[i] ?? 0,
          quotes: counts.quotes[i] ?? 0,
          bookmarks: counts.bookmarks[i] ?? 0,
        })
      }
    }

    return map
  }

  async getFeedGens(
    uris: AtUriString[],
    includeTakedowns = false,
  ): Promise<FeedGens> {
    const map: FeedGens = new HydrationMap()

    if (uris.length) {
      const res = await this.dataplane.getFeedGeneratorRecords({ uris })
      for (let i = 0; i < uris.length; i++) {
        const record = parseRecord<FeedGenRecord>(
          res.records[i],
          includeTakedowns,
        )
        map.set(uris[i], record ?? null)
      }
    }

    return map
  }

  async getFeedGenViewerStates(
    uris: AtUriString[],
    viewer: string,
  ): Promise<FeedGenViewerStates> {
    const map: FeedGenViewerStates = new HydrationMap()

    if (uris.length) {
      const likes = await this.dataplane.getLikesByActorAndSubjects({
        actorDid: viewer,
        refs: uris.map((uri) => ({ uri })),
      })
      for (let i = 0; i < uris.length; i++) {
        map.set(uris[i], {
          like: parseString(likes.uris[i]),
        })
      }
    }

    return map
  }

  async getFeedGenAggregates(
    refs: ItemRef[],
    viewer: string | null,
  ): Promise<FeedGenAggs> {
    const map: FeedGenAggs = new HydrationMap()

    if (refs.length) {
      const counts = await this.dataplane.getInteractionCounts({
        refs,
        skipCacheForDids: viewer ? [viewer] : undefined,
      })
      for (let i = 0; i < refs.length; i++) {
        map.set(refs[i].uri, { likes: counts.likes[i] ?? 0 })
      }
    }

    return map
  }

  async getThreadgatesForPosts(
    postUris: AtUriString[],
    includeTakedowns = false,
  ): Promise<Threadgates> {
    const uris = postUris.map(postUriToThreadgateUri)
    return this.getThreadgateRecords(uris, includeTakedowns)
  }

  async getThreadgateRecords(
    uris: AtUriString[],
    includeTakedowns = false,
  ): Promise<Threadgates> {
    const map: Threadgates = new HydrationMap()

    if (uris.length) {
      const res = await this.dataplane.getThreadGateRecords({ uris })
      for (let i = 0; i < uris.length; i++) {
        const record = parseRecord<GateRecord>(res.records[i], includeTakedowns)
        map.set(uris[i], record ?? null)
      }
    }

    return map
  }

  async getPostgatesForPosts(
    postUris: AtUriString[],
    includeTakedowns = false,
  ): Promise<Postgates> {
    const uris = postUris.map(postUriToPostgateUri)
    return this.getPostgateRecords(uris, includeTakedowns)
  }

  async getPostgateRecords(
    uris: AtUriString[],
    includeTakedowns = false,
  ): Promise<Postgates> {
    const map: Postgates = new HydrationMap()

    if (uris.length) {
      const res = await this.dataplane.getPostgateRecords({ uris })
      for (let i = 0; i < uris.length; i++) {
        const record = parseRecord<PostgateRecord>(
          res.records[i],
          includeTakedowns,
        )
        map.set(uris[i], record ?? null)
      }
    }

    return map
  }

  async getLikes(
    uris: AtUriString[],
    includeTakedowns = false,
  ): Promise<Likes> {
    const map: Likes = new HydrationMap()

    if (uris.length) {
      const res = await this.dataplane.getLikeRecords({ uris })
      for (let i = 0; i < uris.length; i++) {
        const record = parseRecord<LikeRecord>(res.records[i], includeTakedowns)
        map.set(uris[i], record ?? null)
      }
    }

    return map
  }

  async getReposts(
    uris: AtUriString[],
    includeTakedowns = false,
  ): Promise<Reposts> {
    const map: Reposts = new HydrationMap()

    if (uris.length) {
      const res = await this.dataplane.getRepostRecords({ uris })
      for (let i = 0; i < uris.length; i++) {
        const record = parseRecord<RepostRecord>(
          res.records[i],
          includeTakedowns,
        )
        map.set(uris[i], record ?? null)
      }
    }

    return map
  }
}
