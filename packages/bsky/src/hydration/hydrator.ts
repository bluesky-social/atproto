import { AtUri } from '@atproto/syntax'
import { DataPlaneClient } from '../data-plane/client'
import { Notification } from '../data-plane/gen/bsky_pb'
import { ids } from '../lexicon/lexicons'
import { isMain as isEmbedRecord } from '../lexicon/types/app/bsky/embed/record'
import { isMain as isEmbedRecordWithMedia } from '../lexicon/types/app/bsky/embed/recordWithMedia'
import {
  ActorHydrator,
  ProfileAggs,
  Actors,
  ProfileViewerStates,
  ProfileViewerState,
} from './actor'
import {
  Follows,
  GraphHydrator,
  ListItems,
  ListViewerStates,
  Lists,
  RelationshipPair,
} from './graph'
import { LabelHydrator, Labels } from './label'
import { HydrationMap, didFromUri } from './util'
import {
  FeedGenAggs,
  FeedGens,
  FeedGenViewerStates,
  FeedHydrator,
  Likes,
  Post,
  Posts,
  Reposts,
  PostAggs,
  PostViewerStates,
  Threadgates,
} from './feed'
import { mapDefined } from '@atproto/common'

export type HydrationState = {
  actors?: Actors
  profileViewers?: ProfileViewerStates
  profileAggs?: ProfileAggs
  posts?: Posts
  postAggs?: PostAggs
  postViewers?: PostViewerStates
  postBlocks?: PostBlocks
  reposts?: Reposts
  follows?: Follows
  followBlocks?: FollowBlocks
  threadgates?: Threadgates
  lists?: Lists
  listViewers?: ListViewerStates
  listItems?: ListItems
  likes?: Likes
  labels?: Labels
  feedgens?: FeedGens
  feedgenViewers?: FeedGenViewerStates
  feedgenAggs?: FeedGenAggs
}

export type PostBlock = { embed: boolean; reply: boolean }
export type PostBlocks = HydrationMap<PostBlock>
type PostBlockPairs = { embed?: RelationshipPair; reply?: RelationshipPair }

export type FollowBlock = boolean
export type FollowBlocks = HydrationMap<FollowBlock>

export class Hydrator {
  actor: ActorHydrator
  feed: FeedHydrator
  graph: GraphHydrator
  label: LabelHydrator

  constructor(public dataplane: DataPlaneClient) {
    this.actor = new ActorHydrator(dataplane)
    this.feed = new FeedHydrator(dataplane)
    this.graph = new GraphHydrator(dataplane)
    this.label = new LabelHydrator(dataplane)
  }

  // app.bsky.actor.defs#profileView
  // - profile
  //   - list basic
  async hydrateProfiles(
    dids: string[],
    viewer: string | null,
    includeTakedowns = false,
  ): Promise<HydrationState> {
    const [actors, labels, profileViewers] = await Promise.all([
      this.actor.getActors(dids, includeTakedowns),
      this.label.getLabelsForSubjects(labelSubjectsForDid(dids)),
      viewer ? this.actor.getProfileViewerStates(dids, viewer) : undefined,
    ])
    const listUris: string[] = []
    profileViewers?.forEach((item) => {
      listUris.push(...listUrisFromProfileViewer(item))
    })
    const listState = await this.hydrateListsBasic(listUris, viewer)
    return mergeStates(listState, {
      actors,
      labels,
      profileViewers,
    })
  }

  // app.bsky.actor.defs#profileViewBasic
  // - profile basic
  //   - profile
  //     - list basic
  async hydrateProfilesBasic(
    dids: string[],
    viewer: string | null,
    includeTakedowns = false,
  ): Promise<HydrationState> {
    return this.hydrateProfiles(dids, viewer, includeTakedowns)
  }

  // app.bsky.actor.defs#profileViewDetailed
  // - profile detailed
  //   - profile
  //     - list basic
  async hydrateProfilesDetailed(
    dids: string[],
    viewer: string | null,
    includeTakedowns = false,
  ): Promise<HydrationState> {
    const [state, profileAggs] = await Promise.all([
      this.hydrateProfiles(dids, viewer, includeTakedowns),
      this.actor.getProfileAggregates(dids),
    ])
    return {
      ...state,
      profileAggs,
    }
  }

  // app.bsky.graph.defs#listView
  // - list
  //   - profile basic
  async hydrateLists(
    uris: string[],
    viewer: string | null,
  ): Promise<HydrationState> {
    const [listsState, profilesState] = await Promise.all([
      await this.hydrateListsBasic(uris, viewer),
      await this.hydrateProfilesBasic(uris.map(didFromUri), viewer),
    ])
    return mergeStates(listsState, profilesState)
  }

  // app.bsky.graph.defs#listViewBasic
  // - list basic
  async hydrateListsBasic(
    uris: string[],
    viewer: string | null,
  ): Promise<HydrationState> {
    const [lists, listViewers] = await Promise.all([
      this.graph.getLists(uris),
      viewer ? this.graph.getListViewerStates(uris, viewer) : undefined,
    ])
    return { lists, listViewers }
  }

  // app.bsky.graph.defs#listItemView
  // - list item
  //   - profile
  //     - list basic
  async hydrateListItems(
    uris: string[],
    viewer: string | null,
  ): Promise<HydrationState> {
    const listItems = await this.graph.getListItems(uris)
    const dids: string[] = []
    listItems.forEach((item) => {
      if (item) {
        dids.push(item.record.subject)
      }
    })
    const profileState = await this.hydrateProfiles(dids, viewer)
    return mergeStates(profileState, { listItems })
  }

  // app.bsky.feed.defs#postView
  // - post
  //   - profile
  //     - list basic
  //   - list
  //     - profile
  //       - list basic
  //   - feedgen
  //     - profile
  //       - list basic
  async hydratePosts(
    uris: string[],
    viewer: string | null,
    includeTakedowns = false,
  ): Promise<HydrationState> {
    const postsLayer0 = await this.feed.getPosts(uris, includeTakedowns)
    // first level embeds
    const urisLayer1 = nestedRecordUrisFromPosts(postsLayer0)
    const urisLayer1ByCollection = urisByCollection(urisLayer1)
    const postUrisLayer1 = urisLayer1ByCollection.get(ids.AppBskyFeedPost) ?? []
    const postsLayer1 = await this.feed.getPosts(
      postUrisLayer1,
      includeTakedowns,
    )
    // second level embeds
    const urisLayer2 = nestedRecordUrisFromPosts(postsLayer1)
    const urisLayer2ByCollection = urisByCollection(urisLayer2)
    const postUrisLayer2 = urisLayer2ByCollection.get(ids.AppBskyFeedPost) ?? []
    const postsLayer2 = await this.feed.getPosts(
      postUrisLayer2,
      includeTakedowns,
    )
    // collect list/feedgen embeds, post record hydration
    const nestedListUris = [
      ...(urisLayer1ByCollection.get(ids.AppBskyGraphList) ?? []),
      ...(urisLayer2ByCollection.get(ids.AppBskyGraphList) ?? []),
    ]
    const nestedFeedGenUris = [
      ...(urisLayer1ByCollection.get(ids.AppBskyFeedGenerator) ?? []),
      ...(urisLayer2ByCollection.get(ids.AppBskyFeedGenerator) ?? []),
    ]
    const posts =
      mergeManyMaps(postsLayer0, postsLayer1, postsLayer2) ?? postsLayer0
    const allPostUris = [...posts.keys()]
    const [
      postAggs,
      postViewers,
      threadgates,
      labels,
      postBlocks,
      profileState,
      listState,
      feedGenState,
    ] = await Promise.all([
      this.feed.getPostAggregates(uris),
      viewer ? this.feed.getPostViewerStates(uris, viewer) : undefined,
      this.feed.getThreadgatesForPosts(uris),
      this.label.getLabelsForSubjects(allPostUris),
      this.hydratePostBlocks(posts),
      this.hydrateProfiles(
        allPostUris.map(didFromUri),
        viewer,
        includeTakedowns,
      ),
      this.hydrateLists(nestedListUris, viewer),
      this.hydrateFeedGens(nestedFeedGenUris, viewer),
    ])
    // combine all hydration state
    return mergeManyStates(profileState, listState, feedGenState, {
      posts,
      postAggs,
      postViewers,
      postBlocks,
      labels,
      threadgates,
    })
  }

  private async hydratePostBlocks(posts: Posts): Promise<PostBlocks> {
    const postBlocks = new HydrationMap<PostBlock>()
    const postBlocksPairs = new Map<string, PostBlockPairs>()
    const relationships: RelationshipPair[] = []
    for (const [uri, item] of posts) {
      if (!item) continue
      const post = item.record
      const creator = didFromUri(uri)
      const postBlockPairs: PostBlockPairs = {}
      postBlocksPairs.set(uri, postBlockPairs)
      // 3p block for replies
      const parentUri = post.reply?.parent.uri
      const parentDid = parentUri && didFromUri(parentUri)
      if (parentDid) {
        const pair: RelationshipPair = [creator, parentDid]
        relationships.push(pair)
        postBlockPairs.reply = pair
      }
      // 3p block for record embeds
      for (const embedUri of nestedRecordUris(post)) {
        const pair: RelationshipPair = [creator, didFromUri(embedUri)]
        relationships.push(pair)
        postBlockPairs.embed = pair
      }
    }
    // replace embed/reply pairs with block state
    const blocks = await this.graph.getBidirectionalBlocks(relationships)
    for (const [uri, { embed, reply }] of postBlocksPairs) {
      postBlocks.set(uri, {
        embed: !!embed && blocks.isBlocked(...embed),
        reply: !!reply && blocks.isBlocked(...reply),
      })
    }
    return postBlocks
  }

  // app.bsky.feed.defs#feedViewPost
  // - post (+ replies)
  //   - profile
  //     - list basic
  //   - list
  //     - profile
  //       - list basic
  //   - feedgen
  //     - profile
  //       - list basic
  // - repost
  //   - profile
  //     - list basic
  //   - post
  //     - ...
  async hydrateFeedPosts(
    uris: string[],
    viewer: string | null,
    includeTakedowns = false,
  ): Promise<HydrationState> {
    const collectionUris = urisByCollection(uris)
    const postUris = collectionUris.get(ids.AppBskyFeedPost) ?? []
    const repostUris = collectionUris.get(ids.AppBskyFeedRepost) ?? []
    const [posts, reposts, repostProfileState] = await Promise.all([
      this.feed.getPosts(postUris, includeTakedowns),
      this.feed.getReposts(repostUris),
      this.hydrateProfiles(
        repostUris.map(didFromUri),
        viewer,
        includeTakedowns,
      ),
    ])
    const repostPostUris = mapDefined(
      [...reposts.values()],
      (repost) => repost?.record.subject.uri,
    )
    const repostPosts = await this.feed.getPosts(
      repostPostUris,
      includeTakedowns,
    )
    const repostedAndReplyUris: string[] = []
    repostPosts.forEach((post, uri) => {
      repostedAndReplyUris.push(uri)
      if (post?.record.reply) {
        repostedAndReplyUris.push(
          post.record.reply.root.uri,
          post.record.reply.parent.uri,
        )
      }
    })
    posts.forEach((post) => {
      if (post?.record.reply) {
        repostedAndReplyUris.push(
          post.record.reply.root.uri,
          post.record.reply.parent.uri,
        )
      }
    })
    const postState = await this.hydratePosts(
      [...postUris, ...repostedAndReplyUris],
      viewer,
      includeTakedowns,
    )
    return mergeManyStates(postState, repostProfileState, {
      reposts,
    })
  }

  // app.bsky.feed.defs#threadViewPost
  // - post
  //   - profile
  //     - list basic
  //   - list
  //     - profile
  //       - list basic
  //   - feedgen
  //     - profile
  //       - list basic
  async hydrateThreadPosts(
    uris: string[],
    viewer: string | null,
  ): Promise<HydrationState> {
    return this.hydratePosts(uris, viewer)
  }

  // app.bsky.feed.defs#generatorView
  // - feedgen
  //   - profile
  //     - list basic
  async hydrateFeedGens(
    uris: string[],
    viewer: string | null,
  ): Promise<HydrationState> {
    const [feedgens, feedgenAggs, feedgenViewers, profileState] =
      await Promise.all([
        this.feed.getFeedGens(uris),
        this.feed.getFeedGenAggregates(uris),
        viewer ? this.feed.getFeedGenViewerStates(uris, viewer) : undefined,
        this.hydrateProfiles(uris.map(didFromUri), viewer),
      ])
    return mergeStates(profileState, {
      feedgens,
      feedgenAggs,
      feedgenViewers,
    })
  }

  // app.bsky.feed.getLikes#like
  // - like
  //   - profile
  //     - list basic
  async hydrateLikes(
    uris: string[],
    viewer: string | null,
  ): Promise<HydrationState> {
    const [likes, profileState] = await Promise.all([
      this.feed.getLikes(uris),
      this.hydrateProfiles(uris.map(didFromUri), viewer),
    ])
    return mergeStates(profileState, { likes })
  }

  // app.bsky.feed.getRepostedBy#repostedBy
  // - repost
  //   - profile
  //     - list basic
  async hydrateReposts(uris: string[], viewer: string | null) {
    const [reposts, profileState] = await Promise.all([
      this.feed.getReposts(uris),
      this.hydrateProfiles(uris.map(didFromUri), viewer),
    ])
    return mergeStates(profileState, { reposts })
  }

  // app.bsky.notification.listNotifications#notification
  // - notification
  //   - profile
  //     - list basic
  async hydrateNotifications(
    notifs: Notification[],
    viewer: string | null,
  ): Promise<HydrationState> {
    const uris = notifs.map((notif) => notif.uri)
    const collections = urisByCollection(uris)
    const postUris = collections.get(ids.AppBskyFeedPost) ?? []
    const likeUris = collections.get(ids.AppBskyFeedLike) ?? []
    const repostUris = collections.get(ids.AppBskyFeedRepost) ?? []
    const followUris = collections.get(ids.AppBskyGraphFollow) ?? []
    const [posts, likes, reposts, follows, labels, profileState] =
      await Promise.all([
        this.feed.getPosts(postUris), // reason: mention, reply, quote
        this.feed.getLikes(likeUris), // reason: like
        this.feed.getReposts(repostUris), // reason: repost
        this.graph.getFollows(followUris),
        this.label.getLabelsForSubjects(uris),
        this.hydrateProfiles(uris.map(didFromUri), viewer),
      ])
    return mergeStates(profileState, { posts, likes, reposts, follows, labels })
  }

  // provides partial hydration state withing getFollows / getFollowers, mainly for applying rules
  async hydrateFollows(uris: string[]): Promise<HydrationState> {
    const follows = await this.graph.getFollows(uris)
    const pairs: RelationshipPair[] = []
    for (const [uri, follow] of follows) {
      if (follow) {
        pairs.push([didFromUri(uri), follow.record.subject])
      }
    }
    const blocks = await this.graph.getBidirectionalBlocks(pairs)
    const followBlocks = new HydrationMap<FollowBlock>()
    for (const [uri, follow] of follows) {
      if (follow) {
        followBlocks.set(
          uri,
          blocks.isBlocked(didFromUri(uri), follow.record.subject),
        )
      } else {
        followBlocks.set(uri, null)
      }
    }
    return { follows, followBlocks }
  }
}

const listUrisFromProfileViewer = (item: ProfileViewerState | null) => {
  const listUris: string[] = []
  if (item?.mutedByList) {
    listUris.push(item.mutedByList)
  }
  if (item?.blockingByList) {
    listUris.push(item.blockingByList)
  }
  return listUris
}

const labelSubjectsForDid = (dids: string[]) => {
  return [
    ...dids,
    ...dids.map((did) =>
      AtUri.make(did, ids.AppBskyActorProfile, 'self').toString(),
    ),
  ]
}

const nestedRecordUrisFromPosts = (posts: Posts): string[] => {
  const uris: string[] = []
  for (const item of posts.values()) {
    if (item) {
      uris.push(...nestedRecordUris(item.record))
    }
  }
  return uris
}

const nestedRecordUris = (post: Post['record']): string[] => {
  const uris: string[] = []
  if (!post?.embed) return uris
  if (isEmbedRecord(post.embed)) {
    uris.push(post.embed.record.uri)
  } else if (isEmbedRecordWithMedia(post.embed)) {
    uris.push(post.embed.record.record.uri)
  }
  return uris
}

const urisByCollection = (uris: string[]): Map<string, string[]> => {
  const result = new Map<string, string[]>()
  for (const uri of uris) {
    const collection = new AtUri(uri).collection
    const items = result.get(collection) ?? []
    items.push(uri)
    result.set(collection, items)
  }
  return result
}

export const mergeStates = (
  stateA: HydrationState,
  stateB: HydrationState,
): HydrationState => {
  return {
    actors: mergeMaps(stateA.actors, stateB.actors),
    profileAggs: mergeMaps(stateA.profileAggs, stateB.profileAggs),
    profileViewers: mergeMaps(stateA.profileViewers, stateB.profileViewers),
    posts: mergeMaps(stateA.posts, stateB.posts),
    postAggs: mergeMaps(stateA.postAggs, stateB.postAggs),
    postViewers: mergeMaps(stateA.postViewers, stateB.postViewers),
    postBlocks: mergeMaps(stateA.postBlocks, stateB.postBlocks),
    reposts: mergeMaps(stateA.reposts, stateB.reposts),
    follows: mergeMaps(stateA.follows, stateB.follows),
    lists: mergeMaps(stateA.lists, stateB.lists),
    listViewers: mergeMaps(stateA.listViewers, stateB.listViewers),
    listItems: mergeMaps(stateA.listItems, stateB.listItems),
    likes: mergeMaps(stateA.likes, stateB.likes),
    labels: mergeMaps(stateA.labels, stateB.labels),
    feedgens: mergeMaps(stateA.feedgens, stateB.feedgens),
    feedgenAggs: mergeMaps(stateA.feedgenAggs, stateB.feedgenAggs),
    feedgenViewers: mergeMaps(stateA.feedgenViewers, stateB.feedgenViewers),
  }
}

const mergeMaps = <T>(
  mapA?: HydrationMap<T>,
  mapB?: HydrationMap<T>,
): HydrationMap<T> | undefined => {
  if (!mapA) return mapB
  if (!mapB) return mapA
  return mapA.merge(mapB)
}

const mergeManyStates = (...states: HydrationState[]) => {
  return states.reduce(mergeStates, {} as HydrationState)
}

const mergeManyMaps = <T>(...maps: HydrationMap<T>[]) => {
  return maps.reduce(mergeMaps, undefined as HydrationMap<T> | undefined)
}
