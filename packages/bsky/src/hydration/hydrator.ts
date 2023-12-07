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
import { GraphHydrator, ListItems, ListViewerStates, Lists } from './graph'
import { LabelHydrator, Labels } from './label'
import { HydrationMap } from './util'
import {
  FeedGenAggs,
  FeedGens,
  FeedGenViewerStates,
  FeedHydrator,
  Likes,
  Posts,
  Threadgates,
} from './feed'

export type HydrationState = {
  actors?: Actors
  profileViewers?: ProfileViewerStates
  profileAggs?: ProfileAggs
  posts?: Posts
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
  ): Promise<HydrationState> {
    const [actors, labels, profileViewers] = await Promise.all([
      this.actor.getActors(dids),
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
  ): Promise<HydrationState> {
    return this.hydrateProfiles(dids, viewer)
  }

  // app.bsky.actor.defs#profileViewDetailed
  // - profile detailed
  //   - profile
  //     - list basic
  async hydrateProfilesDetailed(
    dids: string[],
    viewer: string | null,
  ): Promise<HydrationState> {
    const [state, profileAggs] = await Promise.all([
      this.hydrateProfiles(dids, viewer),
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
  // @TODO handle 3p blocks
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
  ): Promise<HydrationState> {
    const postsLayer0 = await this.feed.getPosts(uris)
    // first level embeds
    const urisLayer1 = nestedRecordUris(postsLayer0)
    const urisLayer1ByCollection = urisByCollection(urisLayer1)
    const postUrisLayer1 = urisLayer1ByCollection.get(ids.AppBskyFeedPost) ?? []
    const postsLayer1 = await this.feed.getPosts(postUrisLayer1)
    // second level embeds
    const urisLayer2 = nestedRecordUris(postsLayer1)
    const urisLayer2ByCollection = urisByCollection(urisLayer2)
    // collect remaining post embeds, list/feedgen embeds, post record hydration
    const postUrisLayer2 = urisLayer2ByCollection.get(ids.AppBskyFeedPost) ?? []
    const nestedListUris = [
      ...(urisLayer1ByCollection.get(ids.AppBskyGraphList) ?? []),
      ...(urisLayer2ByCollection.get(ids.AppBskyGraphList) ?? []),
    ]
    const nestedFeedGenUris = [
      ...(urisLayer1ByCollection.get(ids.AppBskyFeedGenerator) ?? []),
      ...(urisLayer2ByCollection.get(ids.AppBskyFeedGenerator) ?? []),
    ]
    const allPostUris = [...uris, ...postUrisLayer1, ...postUrisLayer2]
    const [
      postsLayer2,
      labels,
      threadgates,
      profileState,
      listState,
      feedGenState,
    ] = await Promise.all([
      this.feed.getPosts(postUrisLayer2),
      this.label.getLabelsForSubjects(allPostUris),
      this.feed.getThreadgatesForPosts(allPostUris),
      this.hydrateProfiles(allPostUris.map(didFromUri), viewer),
      this.hydrateLists(nestedListUris, viewer),
      this.hydrateFeedGens(nestedFeedGenUris, viewer),
    ])
    // combine all hydration state
    return mergeManyStates(profileState, listState, feedGenState, {
      posts: mergeManyMaps(postsLayer0, postsLayer1, postsLayer2),
      labels,
      threadgates,
    })
  }

  // app.bsky.feed.defs#feedViewPost
  async hydrateFeedPosts(
    uris: string[],
    viewer: string | null,
  ): Promise<HydrationState> {
    throw new Error('not implemented')
  }

  // app.bsky.feed.defs#threadViewPost
  async hydrateThreadPosts(
    uris: string[],
    viewer: string | null,
  ): Promise<HydrationState> {
    throw new Error('not implemented')
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
  async hydrateLikes(uris: string[], viewer: string | null) {
    const [likes, profileState] = await Promise.all([
      this.feed.getLikes(uris),
      this.hydrateProfiles(uris.map(didFromUri), viewer),
    ])
    return mergeStates(profileState, { likes })
  }

  // app.bsky.notification.listNotifications#notification
  // - notification
  //   - profile
  //     - list basic
  async hydrateNotifications(notifs: Notification[], viewer: string | null) {
    const uris = notifs.map((notif) => notif.uri)
    const parsedUris = uris.map((uri) => new AtUri(uri))
    // @TODO incomplete: need support from data plane to fetch more types of original records, such as reposts.
    const postUris = parsedUris
      .filter((uri) => uri.collection === ids.AppBskyFeedPost)
      .map((uri) => uri.toString())
    const likeUris = parsedUris
      .filter((uri) => uri.collection === ids.AppBskyFeedLike)
      .map((uri) => uri.toString())
    const [posts, likes, labels, profileState] = await Promise.all([
      this.feed.getPosts(postUris),
      this.feed.getLikes(likeUris),
      this.label.getLabelsForSubjects(uris), // @TODO can we batch these with profile labels?
      this.hydrateProfiles(uris.map(didFromUri), viewer),
    ])
    return mergeStates(profileState, { posts, likes, labels })
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

const didFromUri = (uri: string) => {
  return new AtUri(uri).hostname
}

const nestedRecordUris = (posts: Posts): string[] => {
  const uris: string[] = []
  for (const item of posts.values()) {
    const post = item?.record
    if (!post?.embed) continue
    if (isEmbedRecord(post.embed)) {
      uris.push(post.embed.record.uri)
    } else if (isEmbedRecordWithMedia(post.embed)) {
      uris.push(post.embed.record.record.uri)
    }
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

const mergeStates = (
  stateA: HydrationState,
  stateB: HydrationState,
): HydrationState => {
  return {
    actors: mergeMaps(stateA.actors, stateB.actors),
    profileAggs: mergeMaps(stateA.profileAggs, stateB.profileAggs),
    profileViewers: mergeMaps(stateA.profileViewers, stateB.profileViewers),
    posts: mergeMaps(stateA.posts, stateB.posts),
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
  const initial: HydrationState = {}
  return states.reduce((acc, state) => mergeStates(acc, state), initial)
}

const mergeManyMaps = <T>(...maps: HydrationMap<T>[]) => {
  return maps.reduce(
    (acc, map) => mergeMaps(acc, map),
    undefined as HydrationMap<T> | undefined,
  )
}
