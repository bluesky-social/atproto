import * as ui8 from 'uint8arrays'
import { Record as ListRecord } from '../lexicon/types/app/bsky/graph/list'
import { DataPlaneClient } from '../data-plane/client'
import { jsonToLex } from '@atproto/lexicon'
import { HydrationMap } from './util'

export type List = ListRecord
export type Lists = HydrationMap<List>

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

  async getListRecords(uris: string[]): Promise<Lists> {
    const res = await this.dataplane.getLists({ uris })
    return uris.reduce((acc, uri, i) => {
      const list = res.records[i]
      const parsed = JSON.parse(ui8.toString(list, 'utf8'))
      const record = parsed ? (jsonToLex(parsed) as ListRecord) : null
      return acc.set(uri, record)
    }, new Map() as Lists)
  }

  async getListsViewerState(
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
    }, new Map() as ListViewerStates)
  }

  async getBidirectionalBlocks(pairs: RelationshipPair[]): Promise<Blocks> {
    throw new Error('unimplemented')
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
}
