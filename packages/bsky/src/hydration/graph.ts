import * as ui8 from 'uint8arrays'
import { Record as ListRecord } from '../lexicon/types/app/bsky/graph/list'
import { DataPlaneClient } from '../data-plane/client'
import { jsonToLex } from '@atproto/lexicon'

export type ListInfo = ListRecord

export type ListInfos = Map<string, ListInfo | null>

export type ListViewerState = {
  viewerMuted?: string
  viewerListBlockUri?: string
  viewerInList?: string
}

export type ListViewerStates = Map<string, ListViewerState | null>

export class GraphHydrator {
  constructor(public dataplane: DataPlaneClient) {}

  async getListRecords(uris: string[]): Promise<ListInfos> {
    const res = await this.dataplane.getLists({ uris })
    return uris.reduce((acc, uri, i) => {
      const list = res.records[i]
      const parsed = JSON.parse(ui8.toString(list, 'utf8'))
      const record = parsed ? (jsonToLex(parsed) as ListRecord) : null
      return acc.set(uri, record)
    }, new Map() as ListInfos)
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
