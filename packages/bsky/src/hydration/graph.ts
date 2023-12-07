import { Record as ListRecord } from '../lexicon/types/app/bsky/graph/list'
import { Record as ListItemRecord } from '../lexicon/types/app/bsky/graph/listitem'
import { DataPlaneClient } from '../data-plane/client'
import { HydrationMap, RecordInfo, parseRecord } from './util'

export type List = RecordInfo<ListRecord>
export type Lists = HydrationMap<List>

export type ListItem = RecordInfo<ListItemRecord>
export type ListItems = HydrationMap<ListItem>

export type ListViewerState = {
  viewerMuted?: string
  viewerListBlockUri?: string
  viewerInList?: string
}

export type ListViewerStates = HydrationMap<ListViewerState>

export type RelationshipPair = [didA: string, didB: string]
export class Blocks {
  has(didA: string, didB: string): boolean {
    throw new Error('unimplemented')
  }

  isBlocked(didA: string, didB: string): boolean {
    throw new Error('unimplemented')
  }

  merge(blocks: Blocks): Blocks {
    throw new Error('unimplemented')
  }
}

export class GraphHydrator {
  constructor(public dataplane: DataPlaneClient) {}

  async getLists(uris: string[]): Promise<Lists> {
    const res = await this.dataplane.getLists({ uris })
    return uris.reduce((acc, uri, i) => {
      return acc.set(uri, parseRecord<ListRecord>(res.records[i]) ?? null)
    }, new HydrationMap<List>())
  }

  // @TODO may not be supported yet by data plane
  async getListItems(uris: string[]): Promise<ListItems> {
    throw new Error('unimplemented')
  }

  async getListViewerStates(
    uris: string[],
    viewer: string,
  ): Promise<ListViewerStates> {
    const mutesAndBlocks = await Promise.all(
      uris.map((uri) => this.getMutesAndBlocks(uri, viewer)),
    )
    const listMemberships = await this.dataplane.getListMembership({
      actorDid: viewer,
      listUris: uris,
    })
    return uris.reduce((acc, uri, i) => {
      return acc.set(uri, {
        viewerMuted: mutesAndBlocks[i].muted ? uri : undefined,
        viewerListBlockUri: mutesAndBlocks[i].listBlockUri,
        viewerInList: listMemberships.listitemUris[i],
      })
    }, new HydrationMap<ListViewerState>())
  }

  private async getMutesAndBlocks(uri: string, viewer: string) {
    const [muted, listBlockUri] = await Promise.all([
      this.dataplane.getMutelistSubscription({
        actorDid: viewer,
        listUri: uri,
      }),
      this.dataplane.getBlocklistSubscription({
        actorDid: viewer,
        listUri: uri,
      }),
    ])
    return {
      muted: muted.subscribed,
      listBlockUri: listBlockUri.listblockUri,
    }
  }

  async getBidirectionalBlocks(pairs: RelationshipPair[]): Promise<Blocks> {
    throw new Error('unimplemented')
  }
}
