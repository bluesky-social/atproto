import {
  type $Typed,
  type AtUriString,
  type DidString,
  type NsidString,
  toDatetimeString,
} from '@atproto/lex-schema'
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
import {
  app,
  type com,
  place,
  site,
  social,
} from '../../../../lexicons/index.js'
import { httpLogger } from '../../../../logger.js'
import { recordUriOf, uriToDid } from '../../../../util/uris.js'
import {
  externalRecordViewRefs,
  isRecordAvailable,
} from '../../../../views/external.js'
import type { Views } from '../../../../views/index.js'
import type { ExternalRecordView } from '../../../../views/types.js'
import type {
  TimelineActivity,
  TimelineHydration,
} from './atmosphere-grouping.js'

/** Request-scoped hydration and visibility for incrementally fetched roots. */
export class AtmosphereTimelineHydrator implements TimelineHydration {
  private state: HydrationState
  private seen = new Set<string>()
  private readonly seenPosts = new Set<AtUriString>()
  private readonly seenAssociatedPosts = new Set<AtUriString>()
  private readonly externalViews = new Map<string, $Typed<ExternalRecordView>>()
  private readonly profiles = new Map<
    DidString,
    app.bsky.actor.defs.ProfileViewBasic
  >()

  constructor(
    private readonly ctx: { hydrator: Hydrator; views: Views },
    private readonly hydrateCtx: HydrateCtxWithViewer,
    private readonly now: number,
    private readonly signal: AbortSignal,
  ) {
    this.state = {
      ctx: hydrateCtx,
      externalPublicationSubscriptions: new HydrationMap(),
    }
  }

  /** Hydrate new roots and their dependencies without repeating prior lookups. */
  async hydrate(uris: AtUriString[]): Promise<void> {
    this.externalViews.clear()
    this.profiles.clear()
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
    const associated = getAtmospherePostUris(this.state).filter(
      (uri) => !this.seenPosts.has(uri) && !this.seenAssociatedPosts.has(uri),
    )
    if (associated.length) {
      for (const uri of associated) this.seenAssociatedPosts.add(uri)
      const seen = new Set(this.seen)
      const postState = await this.ctx.hydrator
        .hydratePosts(
          associated.map((uri) => ({ uri })),
          this.hydrateCtx,
          // @NOTE Isolate post mutations and lookup markers until success.
          { ...this.state, posts: new HydrationMap(this.state.posts) },
          {
            externalSeenRecordKeys: seen,
            externalPublicationSubscriptions:
              this.state.externalPublicationSubscriptions,
          },
        )
        .catch((err) => {
          if (this.signal.aborted) throw err
          httpLogger.warn(
            { err },
            'Unable to hydrate Atmosphere timeline associated posts',
          )
          return undefined
        })
      if (postState) {
        this.state = mergeStates(this.state, postState)
        this.seen = seen
        for (const uri of associated) this.seenPosts.add(uri)
      }
    }
  }

  /** Compose each visible actor profile once for subject and related groups. */
  profile(did: DidString): app.bsky.actor.defs.ProfileViewBasic | undefined {
    if (!this.visibleAuthor(did)) return
    let profile = this.profiles.get(did)
    if (!profile) {
      profile = this.ctx.views.profileBasic(did, this.state)
      if (profile) this.profiles.set(did, profile)
    }
    return profile
  }

  /** Recheck current dependencies and moderation without building a view. */
  isVisible(uri: AtUriString): boolean {
    return this.selectActivity(uri) !== undefined
  }

  /** Select visible metadata before deciding which presentation views are needed. */
  activity(uri: AtUriString, sortedAt: number): TimelineActivity | undefined {
    const selected = this.selectActivity(uri)
    if (!selected) return
    const { info, collection, target, groupable, subscribed } = selected
    return {
      item: app.bsky.unspecced.getAtmosphereTimeline.activityItem.$build({
        record: { uri, cid: info.cid, indexedAt: toDatetimeString(sortedAt) },
        collection,
        viewerState: { subscribed },
      }),
      sortedAt,
      target,
      groupable,
    }
  }

  /** Render a standalone item or the newest item of an actor group. */
  item(
    activity: TimelineActivity,
  ): $Typed<app.bsky.unspecced.getAtmosphereTimeline.ActivityItem> | undefined {
    const { uri } = activity.item.record
    const selected = this.selectActivity(uri)
    if (!selected) return
    const { collection, viewUri, state } = selected
    if (collection === app.bsky.feed.post.$type) {
      const view = this.ctx.views.post(uri, this.state)
      return view
        ? app.bsky.unspecced.getAtmosphereTimeline.activityItem.$build({
            ...activity.item,
            view: app.bsky.feed.defs.postView.$build(view),
          })
        : undefined
    }
    const view = this.externalView(viewUri, state)
    if (!view) return
    const bskyPostRef = getAtmospherePostRef(
      state.externalRecords?.get(viewUri)?.record,
    )
    return app.bsky.unspecced.getAtmosphereTimeline.activityItem.$build({
      ...activity.item,
      view,
      bskyPostRef,
      viewBskyPost: getAtmospherePostView(this.ctx.views, bskyPostRef, state),
    })
  }

  /** Render the shared target, using pinned state when selected through a share. */
  subject(
    activity: TimelineActivity,
  ): app.bsky.unspecced.getAtmosphereTimeline.ActivitySubject | undefined {
    const selected = this.selectActivity(activity.item.record.uri)
    if (!selected) return
    const { viewUri, state } = selected
    const view = this.externalView(viewUri, state)
    if (!view || app.bsky.embed.external.viewLivestream.$isTypeOf(view)) return
    const record = state.externalRecords?.get(viewUri)?.record
    const publication = site.standard.document.$matches(record)
      ? recordUriOf(record.site, site.standard.publication.$type)
      : undefined
    const bskyPostRef = getAtmospherePostRef(record)
    return app.bsky.unspecced.getAtmosphereTimeline.activitySubject.$build({
      uri: viewUri,
      view,
      viewerState: {
        subscribed: publication
          ? !!this.state.externalPublicationSubscriptions?.get(publication)
          : false,
      },
      bskyPostRef,
      viewBskyPost: getAtmospherePostView(this.ctx.views, bskyPostRef, state),
    })
  }

  private externalView(uri: AtUriString, state: HydrationState) {
    // @NOTE Pinned shares have restricted records, even for the same root CID.
    if (state !== this.state) {
      return this.ctx.views.externalRecordView(uri, state, this.now)
    }
    let view = this.externalViews.get(uri)
    if (!view) {
      view = this.ctx.views.externalRecordView(uri, state, this.now)
      if (view) this.externalViews.set(uri, view)
    }
    return view
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
        subscribed = !!subscription
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
      isRecordAvailable(info, uri, state, this.ctx.views) &&
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

/** Collect associated posts after external records and action targets load. */
export function getAtmospherePostUris(state: HydrationState): AtUriString[] {
  const uris = new Set<AtUriString>()
  for (const info of state.externalRecords?.values() ?? []) {
    const ref = getAtmospherePostRef(info?.record)
    const uri = ref && recordUriOf(ref.uri, app.bsky.feed.post.$type)
    if (uri) uris.add(uri)
  }
  return [...uris]
}

/** Compose an associated post without making it a required content dependency. */
export function getAtmospherePostView(
  views: Views,
  ref: com.atproto.repo.strongRef.Main | undefined,
  state: HydrationState,
): app.bsky.feed.defs.PostView | undefined {
  const uri = ref && recordUriOf(ref.uri, app.bsky.feed.post.$type)
  if (!uri || !isRecordAvailable(state.posts?.get(uri), uri, state, views))
    return
  const post = views.post(uri, state)
  if (!post || views.noUnauthenticatedPost(state, post)) return
  return app.bsky.feed.defs.postView.$build(post)
}

/** Read the author-declared reference independently of post availability. */
export function getAtmospherePostRef(
  record: unknown,
): com.atproto.repo.strongRef.Main | undefined {
  if (site.standard.document.$matches(record)) return record.bskyPostRef
  if (place.stream.livestream.$matches(record)) return record.post
}
