import { AtUri } from '@atproto/syntax'
import { DataPlaneClient } from '../data-plane/client'
import { Notification } from '../data-plane/gen/bsky_pb'
import { ids } from '../lexicon/lexicons'
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
} from './feed'

export type HydrationState = {
  actors?: Actors
  profileViewers?: ProfileViewerStates
  profileAggs?: ProfileAggs
  posts?: Posts
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
  async hydratePosts(
    uris: string[],
    viewer: string | null,
  ): Promise<HydrationState> {
    throw new Error('not implemented')
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
    ...dids.map((did) => `at://${did}/${ids.AppBskyActorProfile}/self`),
  ]
}

const didFromUri = (uri: string) => {
  return new AtUri(uri).hostname
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

const mergeMaps = <T>(mapA?: HydrationMap<T>, mapB?: HydrationMap<T>) => {
  if (!mapA) return mapB
  if (!mapB) return mapA
  return mapA.merge(mapB)
}
