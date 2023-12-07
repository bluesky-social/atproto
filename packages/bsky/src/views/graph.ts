import { AtUri } from '@atproto/syntax'
import { HydrationState } from '../hydration/hydrator'
import { ImageUriBuilder } from '../image/uri'
import { ListView, ListViewBasic } from '../lexicon/types/app/bsky/graph/defs'
import { compositeTime } from './util'
import { ActorViews } from './actor'

export class GraphViews {
  constructor(
    public imgUriBuilder: ImageUriBuilder,
    public actor: ActorViews,
  ) {}

  list(uri: string, state: HydrationState): ListView | undefined {
    const creatorDid = new AtUri(uri).hostname
    const list = state.lists?.get(uri)
    if (!list) return
    const creator = this.actor.profileBasic(creatorDid, state)
    if (!creator) return
    const basicView = this.listBasic(uri, state)
    if (!basicView) return

    return {
      ...basicView,
      creator,
      description: list.record.description,
      descriptionFacets: list.record.descriptionFacets,
      indexedAt: compositeTime(
        list.record.createdAt,
        list.indexedAt?.toISOString(),
      ),
    }
  }

  listBasic(uri: string, state: HydrationState): ListViewBasic | undefined {
    const list = state.lists?.get(uri)
    if (!list) {
      return undefined
    }
    const listViewer = state.listViewers?.get(uri)
    const creator = new AtUri(uri).hostname
    return {
      uri,
      cid: list.cid.toString(),
      name: list.record.name,
      purpose: list.record.purpose,
      avatar: list.record.avatar
        ? this.imgUriBuilder.getPresetUri(
            'avatar',
            creator,
            list.record.avatar.ref,
          )
        : undefined,
      indexedAt: compositeTime(
        list.record.createdAt,
        list.indexedAt?.toISOString(),
      ),
      viewer: listViewer
        ? {
            muted: !!listViewer.viewerMuted,
            blocked: listViewer.viewerListBlockUri,
          }
        : undefined,
    }
  }
}
