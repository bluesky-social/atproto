import { DataPlaneClient } from '../data-plane/client'
import {
  ActorHydrator,
  ProfileAggs,
  ProfileInfos,
  ProfileViewerStates,
} from './actor'
import { GraphHydrator, ListInfos, ListViewerStates } from './graph'

export type HydrationState = {
  profiles?: ProfileInfos
  profileViewers?: ProfileViewerStates
  profileAggs?: ProfileAggs
  lists?: ListInfos
  listViewers?: ListViewerStates
}

export class Hydrator {
  actor: ActorHydrator
  graph: GraphHydrator

  constructor(public dataplane: DataPlaneClient) {
    this.actor = new ActorHydrator(dataplane)
    this.graph = new GraphHydrator(dataplane)
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
    const [profiles, profileViewers] = await Promise.all([
      this.actor.getProfiles(dids),
      viewer ? this.actor.getProfileViewerStates(dids, viewer) : null,
    ])
    state.profiles = profiles
    if (profileViewers) {
      state.profileViewers = profileViewers
      const listUris = Object.values(profileViewers).reduce((acc, cur) => {
        if (cur?.mutedByList) {
          acc.push(cur.mutedByList)
        }
        if (cur?.blockingByList) {
          acc.push(cur.blockingByList)
        }
        return acc
      }, [] as string[])
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
  async hydrateLists(uris: string[]): Promise<HydrationState> {
    throw new Error('not implemented')
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
  async hydrateGenerators(uris: string[]): Promise<HydrationState> {
    throw new Error('not implemented')
  }

  // app.bsky.feed.defs#threadgateView
  async hydrateThreadgates(uris: string[]): Promise<HydrationState> {
    throw new Error('not implemented')
  }
}
