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

  // - profile
  //   - list
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
      const [lists, listViewers] = await Promise.all([
        this.graph.getListRecords(listUris),
        viewer ? this.graph.getListsViewerState(listUris, viewer) : null,
      ])
      state.lists = lists
      if (listViewers) {
        state.listViewers = listViewers
      }
    }
    return state
  }

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
}
