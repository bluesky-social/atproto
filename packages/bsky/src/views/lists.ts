import { ImageUriBuilder } from '../image/uri'
import { ListInfo } from '../services/graph/types'
import { ActorInfoMap } from '../services/actor'
import { ListView, ListViewBasic } from '../lexicon/types/app/bsky/graph/defs'

export class GraphService {
  constructor(public imgUriBuilder: ImageUriBuilder) {}

  formatListView(list: ListInfo, profiles: ActorInfoMap): ListView | undefined {
    if (!profiles[list.creator]) {
      return undefined
    }
    return {
      ...this.formatListViewBasic(list),
      creator: profiles[list.creator],
      description: list.description ?? undefined,
      descriptionFacets: list.descriptionFacets
        ? JSON.parse(list.descriptionFacets)
        : undefined,
      indexedAt: list.sortAt,
    }
  }

  formatListViewBasic(list: ListInfo): ListViewBasic {
    return {
      uri: list.uri,
      cid: list.cid,
      name: list.name,
      purpose: list.purpose,
      avatar: list.avatarCid
        ? this.imgUriBuilder.getPresetUri(
            'avatar',
            list.creator,
            list.avatarCid,
          )
        : undefined,
      indexedAt: list.sortAt,
      viewer: {
        muted: !!list.viewerMuted,
        blocked: list.viewerListBlockUri ?? undefined,
      },
    }
  }
}
