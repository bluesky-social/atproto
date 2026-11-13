import type {
  $Typed,
  AtUriString,
  DidString,
  NsidString,
} from '@atproto/lex-schema'
import { AtUri } from '@atproto/syntax'
import {
  type HydrateCtxWithViewer,
  type HydrationState,
  type Hydrator,
  mergeStates,
} from '../../../../../hydration/hydrator.js'
import { HydrationMap } from '../../../../../hydration/util.js'
import {
  app,
  type com,
  place,
  site,
  social,
} from '../../../../../lexicons/index.js'
import { httpLogger } from '../../../../../logger.js'
import { recordUriOf, uriToDid } from '../../../../../util/uris.js'
import {
  externalRecordViewRefs,
  isLivestreamLive,
  isRecordAvailable,
} from '../../../../../views/external.js'
import type { Views } from '../../../../../views/index.js'
import type { ExternalRecordView } from '../../../../../views/types.js'
import type { TimelineActivity, TimelineHydration } from './grouping.js'

type ActivitySubject =
  app.bsky.unspecced.getAtmosphereTimelineV2.ActivitySubject

/**
 * Root collections V2 shows: creations (articles, galleries, livestreams) and
 * actions targeting content. Other roots, such as Bluesky post shares and
 * publication creations, are never hydrated or shown.
 */
const ACTIVITY_COLLECTIONS: ReadonlySet<string> = new Set([
  site.standard.document.$type,
  social.grain.gallery.$type,
  place.stream.livestream.$type,
  site.standard.graph.recommend.$type,
  site.standard.graph.subscription.$type,
  social.grain.favorite.$type,
])

/** Request-scoped hydration and visibility for incrementally fetched roots. */
export class AtmosphereTimelineHydrator implements TimelineHydration {
  private state: HydrationState
  private seen = new Set<string>()
  private readonly seenAssociatedPosts = new Set<AtUriString>()
  private readonly externalViews = new Map<string, $Typed<ExternalRecordView>>()

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
    this.state = mergeStates(
      this.state,
      await this.ctx.hydrator.hydrateEmbedExternalViewFromUris(
        uris.filter((uri) =>
          ACTIVITY_COLLECTIONS.has(new AtUri(uri).collection),
        ),
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
    const associated = getAtmospherePostUris(this.state).filter(
      (uri) => !this.seenAssociatedPosts.has(uri),
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
      }
    }
  }

  /** Compose a profile for an actor whose activity is visible. */
  profile(did: DidString): app.bsky.actor.defs.ProfileViewBasic | undefined {
    if (!this.visibleAuthor(did)) return
    return this.ctx.views.profileBasic(did, this.state)
  }

  /** Recheck current dependencies and moderation without building a view. */
  isVisible(uri: AtUriString): boolean {
    return this.selectActivity(uri) !== undefined
  }

  /** Select visible metadata before deciding which presentation views are needed. */
  activity(uri: AtUriString, sortedAt: number): TimelineActivity | undefined {
    const selected = this.selectActivity(uri)
    if (!selected) return
    const { info, collection, target, groupable } = selected
    return {
      ref: { uri, cid: info.cid },
      collection,
      actor: uriToDid(uri),
      sortedAt,
      subject: target ?? uri,
      creation: target === undefined,
      groupable,
    }
  }

  /** Render an activity's subject: its target, or the record it created. */
  subject(activity: TimelineActivity): ActivitySubject | undefined {
    const uri = activity.subject
    const info = this.state.externalRecords?.get(uri)
    const view = this.externalView(uri)
    if (!info || !view) return
    const bskyPostRef = getAtmospherePostRef(info.record)
    return app.bsky.unspecced.getAtmosphereTimelineV2.activitySubject.$build({
      ref: { uri, cid: info.cid },
      view,
      bskyPostRef,
      bskyPostView: getAtmospherePostView(
        this.ctx.views,
        bskyPostRef,
        this.state,
      ),
    })
  }

  private externalView(uri: AtUriString) {
    let view = this.externalViews.get(uri)
    if (!view) {
      view = this.ctx.views.externalRecordView(
        uri,
        this.state,
        this.now,
        undefined,
        { publicationViewer: true, livestreamCreatedAtHeartbeat: true },
      )
      if (view) this.externalViews.set(uri, view)
    }
    return view
  }

  private selectActivity(uri: AtUriString) {
    const info = this.state.externalRecords?.get(uri)
    if (
      !isRecordAvailable(info, uri, this.state, this.ctx.views) ||
      !this.visibleAuthor(uriToDid(uri))
    ) {
      return
    }
    const collection = new AtUri(uri).collection as NsidString
    if (!ACTIVITY_COLLECTIONS.has(collection)) return
    const { record } = info
    let target: AtUriString | undefined
    let groupable = true

    if (site.standard.graph.recommend.$matches(record)) {
      target = recordUriOf(record.document, site.standard.document.$type)
      if (!target) return
    } else if (site.standard.graph.subscription.$matches(record)) {
      target = recordUriOf(record.publication, site.standard.publication.$type)
      if (!target) return
    } else if (social.grain.favorite.$matches(record)) {
      target = recordUriOf(record.subject, social.grain.gallery.$type)
      if (!target) return
    } else if (site.standard.document.$matches(record)) {
      const publication = recordUriOf(
        record.site,
        site.standard.publication.$type,
      )
      // @NOTE Articles from subscribed (or unknown) publications stand alone.
      groupable = publication
        ? this.state.externalPublicationSubscriptions?.get(publication) ===
          false
        : true
    } else if (place.stream.livestream.$matches(record)) {
      // @NOTE Ended livestreams are omitted, and live ones stand alone.
      if (!isLivestreamLive(record, this.now)) return
      groupable = false
    } else if (!social.grain.gallery.$matches(record)) {
      return
    }
    if (!this.visibleExternal(target ?? uri)) return
    return { info, collection, target, groupable }
  }

  private visibleAuthor(did: DidString): boolean {
    const { views } = this.ctx
    return (
      this.hasUnmutedAuthor(did) &&
      !views.actorIsNoHosted(did, this.state) &&
      !views.viewerBlockExists(did, this.state) &&
      views.viewerSeesNeedsReview({ did }, this.state)
    )
  }

  private hasUnmutedAuthor(did: DidString): boolean {
    // @NOTE Shared views tolerate absent profiles; timeline activity needs one.
    return (
      !!this.state.actors?.get(did) &&
      !this.ctx.views.viewerMuteExists(did, this.state)
    )
  }

  private visibleExternal(uri: AtUriString): boolean {
    const refs = externalRecordViewRefs(this.ctx.views, uri, this.state)
    return (
      !!refs &&
      refs.every((ref) => this.hasUnmutedAuthor(uriToDid(ref))) &&
      (new AtUri(uri).collection !== social.grain.gallery.$type ||
        refs.length > 1)
    )
  }
}

/** Collect associated posts after external records and action targets load. */
function getAtmospherePostUris(state: HydrationState): AtUriString[] {
  const uris = new Set<AtUriString>()
  for (const info of state.externalRecords?.values() ?? []) {
    const ref = getAtmospherePostRef(info?.record)
    const uri = ref && recordUriOf(ref.uri, app.bsky.feed.post.$type)
    if (uri) uris.add(uri)
  }
  return [...uris]
}

/** Compose an associated post without making it a required content dependency. */
function getAtmospherePostView(
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
function getAtmospherePostRef(
  record: unknown,
): com.atproto.repo.strongRef.Main | undefined {
  if (site.standard.document.$matches(record)) return record.bskyPostRef
  if (place.stream.livestream.$matches(record)) return record.post
}
