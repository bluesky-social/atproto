import { AtUri } from '@atproto/syntax'
import { DataPlaneClient } from '../data-plane/client'
import { ids } from '../lexicon/lexicons'
import {
  ActorHydrator,
  ProfileAggs,
  Profiles,
  ProfileViewerStates,
} from './actor'
import { GraphHydrator, ListViewerStates, Lists } from './graph'
import { LabelHydrator, Labels } from './label'
import { HydrationMap } from './util'
import {
  FeedGenAggs,
  FeedGens,
  FeedGenViewerStates,
  FeedHydrator,
} from './feed'

export type HydrationState = {
  profiles?: Profiles
  profileViewers?: ProfileViewerStates
  profileAggs?: ProfileAggs
  lists?: Lists
  listViewers?: ListViewerStates
  labels?: Labels
  generators?: FeedGens
  generatorViewers?: FeedGenViewerStates
  generatorAggs?: FeedGenAggs
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
  //   - list
  //   - labels
  async hydrateProfiles(
    dids: string[],
    viewer: string | null,
  ): Promise<HydrationState> {
    const state: HydrationState = {}
    const [profiles, labels, profileViewers] = await Promise.all([
      this.actor.getProfiles(dids),
      this.label.getLabelsForSubjects(labelSubjectsForDid(dids)),
      viewer ? this.actor.getProfileViewerStates(dids, viewer) : null,
    ])
    state.profiles = profiles
    state.labels = labels
    if (profileViewers) {
      state.profileViewers = profileViewers
      const listUris: string[] = []
      profileViewers.forEach((item) => {
        if (item?.mutedByList) {
          listUris.push(item.mutedByList)
        }
        if (item?.blockingByList) {
          listUris.push(item.blockingByList)
        }
      })
      const listState = await this.hydrateListsBasic(listUris, viewer)
      state.lists = listState.lists
      state.listViewers = listState.listViewers
    }
    return state
  }

  // app.bsky.actor.defs#profileViewBasic
  // - profile
  //   - list
  async hydrateProfilesBasic(
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

  // app.bsky.actor.defs#profileViewDetailed
  // - profile
  //   - list
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
  async hydrateLists(
    uris: string[],
    viewer: string | null,
  ): Promise<HydrationState> {
    const [listsState, profilesState] = await Promise.all([
      await this.hydrateListsBasic(uris, viewer),
      await this.hydrateProfilesBasic(uris.map(didFromUri), viewer),
    ])
    return mergeHydrationStates(listsState, profilesState)
  }

  // app.bsky.graph.defs#listViewBasic
  async hydrateListsBasic(
    uris: string[],
    viewer: string | null,
  ): Promise<HydrationState> {
    const state: HydrationState = {}
    const [lists, listViewers] = await Promise.all([
      this.graph.getListRecords(uris),
      viewer ? this.graph.getListsViewerState(uris, viewer) : null,
    ])
    state.lists = lists
    if (listViewers) {
      state.listViewers = listViewers
    }
    return state
  }

  // app.bsky.feed.defs#postView
  async hydratePosts(uris: string[]): Promise<HydrationState> {
    throw new Error('not implemented')
  }

  // app.bsky.feed.defs#feedViewPost
  async hydrateFeedPosts(uris: string[]): Promise<HydrationState> {
    throw new Error('not implemented')
  }

  // app.bsky.feed.defs#threadViewPost
  async hydrateThreadPosts(uris: string[]): Promise<HydrationState> {
    throw new Error('not implemented')
  }

  // app.bsky.feed.defs#generatorView
  async hydrateGenerators(uris: string[], viewer): Promise<HydrationState> {
    const [generators, generatorAggs, generatorViewers, profileState] =
      await Promise.all([
        this.feed.getFeedGens(uris),
        this.feed.getFeedGenAggregates(uris),
        viewer ? this.feed.getFeedGenViewerStates(uris, viewer) : undefined,
        this.hydrateProfiles(uris.map(didFromUri), viewer),
      ])
    return mergeHydrationStates(profileState, {
      generators,
      generatorAggs,
      generatorViewers,
    })
  }
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

const mergeHydrationStates = (
  stateA: HydrationState,
  stateB: HydrationState,
): HydrationState => {
  return {
    labels: mergeMaps(stateA.labels, stateB.labels),
    listViewers: mergeMaps(stateA.listViewers, stateB.listViewers),
    lists: mergeMaps(stateA.lists, stateB.lists),
    profileAggs: mergeMaps(stateA.profileAggs, stateB.profileAggs),
    profileViewers: mergeMaps(stateA.profileViewers, stateB.profileViewers),
    profiles: mergeMaps(stateA.profiles, stateB.profiles),
    generators: mergeMaps(stateA.generators, stateB.generators),
    generatorViewers: mergeMaps(
      stateA.generatorViewers,
      stateB.generatorViewers,
    ),
    generatorAggs: mergeMaps(stateA.generatorAggs, stateB.generatorAggs),
  }
}

const mergeMaps = <T>(mapA?: HydrationMap<T>, mapB?: HydrationMap<T>) => {
  if (!mapA) return mapB
  if (!mapB) return mapA
  return mapA.merge(mapB)
}
