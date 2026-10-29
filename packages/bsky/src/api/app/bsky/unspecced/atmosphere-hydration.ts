import { chunkArray } from '@atproto/common'
import {
  type AtUriString,
  type DidString,
  isAtUriString,
  toDatetimeString,
} from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import {
  type ExternalRecord,
  externalAssociatedRefsFromPosts,
  genericRecordKey,
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
import type { Views } from '../../../../views/index.js'
import type { TimelineActivity } from './atmosphere-grouping.js'

/** Request-scoped hydration and visibility for incrementally fetched roots. */
export class AtmosphereTimelineHydrator {
  private state: HydrationState
  private readonly seen = new Set<string>()
  private readonly seenPosts = new Set<AtUriString>()
  private readonly subscriptions = new Map<AtUriString, boolean | undefined>()

  constructor(
    private readonly ctx: { hydrator: Hydrator; views: Views },
    private readonly hydrateCtx: HydrateCtxWithViewer,
    private readonly now: number,
  ) {
    this.state = { ctx: hydrateCtx }
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
        { hydration: 'basic', seenRecordKeys: this.seen },
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
          { externalSeenRecordKeys: this.seen },
        ),
      )
    }

    const publications = new Set<AtUriString>()
    const discoverPublication = (info: ExternalRecord | null) => {
      if (!info || !site.standard.document.$matches(info.record)) return
      const publication = recordUriOf(
        info.record.site,
        site.standard.publication.$type,
      )
      if (publication && !this.subscriptions.has(publication)) {
        publications.add(publication)
      }
    }
    this.state.externalRecords?.forEach(discoverPublication)
    this.state.externalRecordsByRef?.forEach(discoverPublication)
    for (const batch of chunkArray([...publications], 100)) {
      const result =
        await this.ctx.hydrator.external.getAtmosphereBacklinksByActor(
          batch,
          this.hydrateCtx.viewer as DidString,
          site.standard.graph.subscription.$type,
        )
      for (const publication of batch) {
        const subscribed = result.backlinks
          .get(publication)
          ?.some(
            (uri) =>
              recordUriOf(uri, site.standard.graph.subscription.$type) &&
              uriToDid(uri) === this.hydrateCtx.viewer,
          )
        // @NOTE An omitted result in a truncated batch is unknown, not false.
        this.subscriptions.set(
          publication,
          subscribed ? true : result.truncated ? undefined : false,
        )
      }
    }
  }

  /** Return only an already-loaded, visible author profile for overflow. */
  profile(did: DidString): app.bsky.actor.defs.ProfileViewBasic | undefined {
    if (!this.visibleAuthor(did)) return
    return this.ctx.views.profileBasic(did, this.state)
  }

  /** Compose a renderable root and the target used by final-page grouping. */
  activity(uri: AtUriString, sortedAt: number): TimelineActivity | undefined {
    const { views } = this.ctx
    if (!this.visibleRecord(uri, this.state)) return
    const collection = new AtUri(uri).collection
    let info = this.state.externalRecords?.get(uri)
    let view: app.bsky.unspecced.getAtmosphereTimeline.AtmosphereItem['view']
    let target: AtUriString | undefined
    let groupable = true
    let subscribed = false

    if (collection === app.bsky.feed.post.$type) {
      const post = this.state.posts?.get(uri)
      if (!post || !app.bsky.feed.post.$matches(post.record)) return
      const layer: Posts = new HydrationMap([[uri, post]])
      const ref = externalAssociatedRefsFromPosts(layer).find(
        ({ uri }) => !!recordUriOf(uri, site.standard.document.$type),
      )
      if (!ref) return
      const document = this.state.externalRecordsByRef?.get(
        genericRecordKey(ref),
      )
      if (!document) return
      // @NOTE A share pins its document; do not substitute the latest version.
      const state = {
        ...this.state,
        externalRecords: new HydrationMap(this.state.externalRecords),
      }
      state.externalRecords.set(ref.uri, document)
      if (!this.renderExternal(ref.uri, state)) return
      const postView = views.post(uri, this.state)
      if (!postView) return
      view = app.bsky.feed.defs.postView.$build(postView)
      info = post
      target = ref.uri
      groupable = false
    } else {
      if (!info) return
      const { record } = info
      let viewUri = uri
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
      view = this.renderExternal(viewUri, this.state)
      if (!view) return
      if (site.standard.document.$matches(record)) {
        const publication = recordUriOf(
          record.site,
          site.standard.publication.$type,
        )
        const subscription = publication
          ? this.subscriptions.get(publication)
          : false
        subscribed = subscription === true
        groupable = subscription === false
      } else if (place.stream.livestream.$matches(record)) {
        groupable = !!record.endedAt
      }
    }
    if (!info) return
    return {
      item: app.bsky.unspecced.getAtmosphereTimeline.atmosphereItem.$build({
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

  private visibleAuthor(did: DidString, state = this.state): boolean {
    const { views } = this.ctx
    return (
      !!state.actors?.get(did) &&
      !views.actorIsNoHosted(did, state) &&
      !views.viewerBlockExists(did, state) &&
      !views.viewerMuteExists(did, state) &&
      views.viewerSeesNeedsReview({ did }, state)
    )
  }

  private visibleRecord(uri: AtUriString, state: HydrationState): boolean {
    const info = state.externalRecords?.get(uri) ?? state.posts?.get(uri)
    return (
      !!info &&
      new AtUri(uri).collection === info.record.$type &&
      !info.takedownRef &&
      !state.labels?.get(uri)?.isTakendown &&
      this.visibleAuthor(uriToDid(uri), state) &&
      this.ctx.views.viewerSeesNeedsReview({ uri }, state)
    )
  }

  private renderExternal(uri: AtUriString, state: HydrationState) {
    if (!this.visibleRecord(uri, state)) return
    const record = state.externalRecords?.get(uri)?.record
    if (
      site.standard.document.$matches(record) &&
      isAtUriString(record.site) &&
      !this.visibleRecord(record.site, state)
    ) {
      return
    }
    const view = this.ctx.views.externalRecordView(uri, state, this.now)
    if (!view) return
    if (
      view.associatedRefs?.some(({ uri }) => !this.visibleRecord(uri, state)) ||
      (app.bsky.embed.external.viewGallery.$isTypeOf(view) &&
        !view.items.length)
    ) {
      return
    }
    return view
  }
}
