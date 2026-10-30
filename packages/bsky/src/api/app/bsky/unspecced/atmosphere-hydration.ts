import {
  type AtUriString,
  type DidString,
  type NsidString,
  toDatetimeString,
} from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import {
  type ExternalRecord,
  externalAssociatedRefsFromPosts,
  getSiteStandardRecordsFromRefs,
} from '../../../../hydration/external.js'
import type { Posts } from '../../../../hydration/feed.js'
import {
  type HydrateCtxWithViewer,
  type HydrationState,
  type Hydrator,
  mergeStates,
} from '../../../../hydration/hydrator.js'
import { HydrationMap } from '../../../../hydration/util.js'
import { app, place, site, social } from '../../../../lexicons/index.js'
import { recordUriOf, uriToDid } from '../../../../util/uris.js'
import {
  availableRecord,
  externalRecordViewRefs,
} from '../../../../views/external.js'
import type { Views } from '../../../../views/index.js'
import type { TimelineActivity } from './atmosphere-grouping.js'

/** Request-scoped hydration and visibility for incrementally fetched roots. */
export class AtmosphereTimelineHydrator {
  private state: HydrationState
  private readonly seen = new Set<string>()
  private readonly seenPosts = new Set<AtUriString>()

  constructor(
    private readonly ctx: { hydrator: Hydrator; views: Views },
    private readonly hydrateCtx: HydrateCtxWithViewer,
    private readonly now: number,
  ) {
    this.state = {
      ctx: hydrateCtx,
      externalPublicationSubscriptions: new HydrationMap(),
    }
  }

  /** Hydrate new roots and their dependencies without repeating prior lookups. */
  async hydrate(uris: AtUriString[]): Promise<void> {
    const posts: AtUriString[] = []
    const external: AtUriString[] = []
    for (const uri of uris) {
      if (new AtUri(uri).collection === app.bsky.feed.post.$type) {
        if (this.seenPosts.has(uri)) continue
        this.seenPosts.add(uri)
        posts.push(uri)
      } else {
        external.push(uri)
      }
    }
    this.state = mergeStates(
      this.state,
      await this.ctx.hydrator.hydrateEmbedExternalViewFromUris(
        external,
        this.hydrateCtx,
        {
          hydration: 'basic',
          seenRecordKeys: this.seen,
          publicationSubscriptions: this.state.externalPublicationSubscriptions,
        },
      ),
    )
    // @NOTE Latest lookups also satisfy exact refs to that same version.
    for (const key of this.state.externalRecordsByRef?.keys() ?? []) {
      this.seen.add(key)
    }
    if (posts.length) {
      this.state = mergeStates(
        this.state,
        await this.ctx.hydrator.hydratePosts(
          posts.map((uri) => ({ uri })),
          this.hydrateCtx,
          this.state,
          {
            externalSeenRecordKeys: this.seen,
            externalPublicationSubscriptions:
              this.state.externalPublicationSubscriptions,
          },
        ),
      )
    }
  }

  /** Return only an already-loaded, visible author profile for overflow. */
  profile(did: DidString): app.bsky.actor.defs.ProfileViewBasic | undefined {
    if (!this.visibleAuthor(did)) return
    return this.ctx.views.profileBasic(did, this.state)
  }

  /** Recheck current dependencies and moderation without building a view. */
  isVisible(uri: AtUriString): boolean {
    return this.selectActivity(uri) !== undefined
  }

  /** Compose a renderable root and the target used by final-page grouping. */
  activity(uri: AtUriString, sortedAt: number): TimelineActivity | undefined {
    const selected = this.selectActivity(uri)
    if (!selected) return
    const { info, collection, target, groupable, subscribed, viewUri, state } =
      selected
    let view: app.bsky.unspecced.getAtmosphereTimeline.ActivityItem['view']
    if (collection === app.bsky.feed.post.$type) {
      const postView = this.ctx.views.post(uri, this.state)
      if (!postView) return
      view = app.bsky.feed.defs.postView.$build(postView)
    } else {
      view = this.ctx.views.externalRecordView(viewUri, state, this.now)
      if (!view) return
    }
    return {
      item: app.bsky.unspecced.getAtmosphereTimeline.activityItem.$build({
        record: { uri, cid: info.cid, indexedAt: toDatetimeString(sortedAt) },
        collection,
        viewerState: { subscribed },
        view,
      }),
      sortedAt,
      target,
      groupable,
    }
  }

  private selectActivity(uri: AtUriString) {
    if (!this.visibleRecord(uri, this.state)) return
    const collection = new AtUri(uri).collection
    let info = this.state.externalRecords?.get(uri)
    let viewUri = uri
    let state = this.state
    let target: AtUriString | undefined
    let groupable = true
    let subscribed = false

    if (collection === app.bsky.feed.post.$type) {
      const post = this.state.posts?.get(uri)
      if (!post || !app.bsky.feed.post.$matches(post.record)) return
      const layer: Posts = new HydrationMap([[uri, post]])
      const { document, publication } = getSiteStandardRecordsFromRefs(
        externalAssociatedRefsFromPosts(layer),
        this.state.externalRecordsByRef,
        this.state.externalRecords,
      )
      if (!document) return
      // @NOTE Only the pinned document and its publication back this view.
      const externalRecords = new HydrationMap<AtUriString, ExternalRecord>([
        [document.ref.uri, document.info],
      ])
      if (publication) {
        externalRecords.set(publication.ref.uri, publication.info)
      }
      state = { ...this.state, externalRecords }
      viewUri = document.ref.uri
      info = post
      target = document.ref.uri
      groupable = false
    } else {
      if (!info) return
      const { record } = info
      if (
        collection === site.standard.graph.recommend.$type &&
        site.standard.graph.recommend.$matches(record)
      ) {
        target = recordUriOf(record.document, site.standard.document.$type)
      } else if (
        collection === site.standard.graph.subscription.$type &&
        site.standard.graph.subscription.$matches(record)
      ) {
        target = recordUriOf(
          record.publication,
          site.standard.publication.$type,
        )
      } else if (
        collection === social.grain.favorite.$type &&
        social.grain.favorite.$matches(record)
      ) {
        target = recordUriOf(record.subject, social.grain.gallery.$type)
      } else if (
        collection !== site.standard.document.$type &&
        collection !== site.standard.publication.$type &&
        collection !== social.grain.gallery.$type &&
        collection !== place.stream.livestream.$type
      ) {
        return
      }
      if (
        collection === site.standard.graph.recommend.$type ||
        collection === site.standard.graph.subscription.$type ||
        collection === social.grain.favorite.$type
      ) {
        if (!target) return
        viewUri = target
      }
      if (site.standard.document.$matches(record)) {
        const publication = recordUriOf(
          record.site,
          site.standard.publication.$type,
        )
        const subscription = publication
          ? this.state.externalPublicationSubscriptions?.get(publication)
          : false
        subscribed = subscription === true
        groupable = subscription === false
      } else if (place.stream.livestream.$matches(record)) {
        groupable = !!record.endedAt
      }
    }
    if (!info || !this.visibleExternal(viewUri, state)) return
    return {
      info,
      collection: collection as NsidString,
      target,
      groupable,
      subscribed,
      viewUri,
      state,
    }
  }

  private visibleAuthor(did: DidString, state = this.state): boolean {
    const { views } = this.ctx
    return (
      this.hasUnmutedAuthor(did, state) &&
      !views.actorIsNoHosted(did, state) &&
      !views.viewerBlockExists(did, state) &&
      views.viewerSeesNeedsReview({ did }, state)
    )
  }

  private hasUnmutedAuthor(did: DidString, state: HydrationState): boolean {
    // @NOTE Shared views tolerate absent profiles; timeline activity needs one.
    return (
      !!state.actors?.get(did) && !this.ctx.views.viewerMuteExists(did, state)
    )
  }

  private visibleRecord(uri: AtUriString, state: HydrationState): boolean {
    const info = state.externalRecords?.get(uri) ?? state.posts?.get(uri)
    return (
      !!availableRecord(this.ctx.views, uri, state, info) &&
      this.hasUnmutedAuthor(uriToDid(uri), state)
    )
  }

  private visibleExternal(uri: AtUriString, state: HydrationState): boolean {
    const refs = externalRecordViewRefs(this.ctx.views, uri, state)
    return (
      !!refs &&
      refs.every((ref) => this.hasUnmutedAuthor(uriToDid(ref), state)) &&
      (new AtUri(uri).collection !== social.grain.gallery.$type ||
        refs.length > 1)
    )
  }
}
