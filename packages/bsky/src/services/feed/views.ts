import Database from '../../db'
import { GeneratorView } from '../../lexicon/types/app/bsky/feed/defs'
import { ProfileView } from '../../lexicon/types/app/bsky/actor/defs'
import { FeedGenInfo } from './types'
import { Labels } from '../label'
import { ImageUriBuilder } from '../../image/uri'

export class FeedViews {
  constructor(public db: Database, public imgUriBuilder: ImageUriBuilder) {}

  static creator(imgUriBuilder: ImageUriBuilder) {
    return (db: Database) => new FeedViews(db, imgUriBuilder)
  }

  formatFeedGeneratorView(
    info: FeedGenInfo,
    profiles: Record<string, ProfileView>,
    labels?: Labels,
  ): GeneratorView {
    const profile = profiles[info.creator]
    if (profile) {
      // If the creator labels are not hydrated yet, attempt to pull them
      // from labels: e.g. compatible with embedsForPosts() batching label hydration.
      profile.labels ??= labels?.[info.creator] ?? []
    }
    return {
      uri: info.uri,
      cid: info.cid,
      did: info.feedDid,
      creator: profile,
      displayName: info.displayName ?? undefined,
      description: info.description ?? undefined,
      descriptionFacets: info.descriptionFacets
        ? JSON.parse(info.descriptionFacets)
        : undefined,
      avatar: info.avatarCid
        ? this.imgUriBuilder.getCommonSignedUri(
            'avatar',
            info.creator,
            info.avatarCid,
          )
        : undefined,
      likeCount: info.likeCount,
      viewer: {
        like: info.viewerLike ?? undefined,
      },
      indexedAt: info.indexedAt,
    }
  }
}
