import { createHash } from 'node:crypto'
import { mapDefined } from '@atproto/common'
import {
  type AtUriString,
  type DatetimeString,
  type DidString,
  asDatetimeString,
} from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import type { Server } from '@atproto/xrpc-server'
import type { ServerConfig } from '../../../../config.js'
import type { AppContext } from '../../../../context.js'
import type {
  HydrateCtxWithViewer,
  HydrationState,
  Hydrator,
} from '../../../../hydration/hydrator.js'
import { app } from '../../../../lexicons/index.js'
import {
  type HydrationFnInput,
  type PresentationFnInput,
  type RulesFnInput,
  type SkeletonFnInput,
  createPipeline,
} from '../../../../pipeline.js'
import { NotificationFeed } from '../../../../proto/bsky_pb.js'
import { uriToDid } from '../../../../util/uris.js'
import type { Views } from '../../../../views/index.js'
import { resHeaders } from '../../../util.js'
import { NOTIFICATION_REASON } from './constants.js'
import {
  type NotificationGroup,
  type NotificationItem,
  type RawNotification,
  buildGroups,
  parseRawNotification,
} from './grouping/grouping.js'
import {
  compareNotificationGroupsNewestFirst,
  isNotificationRead,
} from './grouping/shared.js'
import { buildSpotlight } from './grouping/spotlight.js'
import {
  delayCursor,
  shouldFilterForNeedsReview,
  shouldFilterHiddenThreadTag,
  shouldFilterReplyByThreadgate,
} from './util.js'

const MIN_RAW_LIMIT = 300
const MAX_RAW_ITEMS = 3000
const MAX_READS = 3
const MAX_GROUP_ITEMS_WITH_RELATED_VIEWS = 5

export const getNextRawLimit = (
  itemsFetched: number,
  groupsBuilt: number,
  groupsNeeded: number,
): number => {
  // How many raw items we still can fetch until hit the max.
  const remainingItems = MAX_RAW_ITEMS - itemsFetched
  if (remainingItems <= 0) return 0

  // Defensive fallback to avoid a division by 0 later.
  // This is for the scenario where fetched items but couldn't build any groups with them
  // (let's say all notifications are missing data and are filtered out, shouldn't happen in practice).
  if (groupsBuilt === 0) return Math.min(MIN_RAW_LIMIT, remainingItems)

  // How many groups still to be built - note that we might still fit items into existing groups.
  const groupsMissing = Math.max(0, groupsNeeded - groupsBuilt)

  const averagePerGroup = itemsFetched / groupsBuilt

  // Estimate additional raw notifications from the average group size.
  const estimatedRawItems = Math.ceil(averagePerGroup * groupsMissing)

  // Keep the estimate above the minimum batch and within the total raw-item budget.
  return Math.min(remainingItems, Math.max(MIN_RAW_LIMIT, estimatedRawItems))
}

export default function (server: Server, ctx: AppContext) {
  const getGroupedNotifications = createPipeline(
    skeleton,
    hydration,
    rules,
    presentation,
  )
  server.add(app.bsky.notification.getGroupedNotifications, {
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const features = ctx.featureGatesClient.scope(
        ctx.featureGatesClient.parseUserContextFromHandler({ viewer, req }),
      )
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        features,
      })
      const lastSeenRes = await ctx.hydrator.dataplane.getNotificationSeen({
        actorDid: viewer,
      })
      const seenAt = lastSeenRes.timestamp
        ? asDatetimeString(lastSeenRes.timestamp.toJson() as string)
        : undefined
      const body = await getGroupedNotifications(
        { ...params, hydrateCtx, seenAt },
        ctx,
      )
      return {
        encoding: 'application/json',
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
        body,
      }
    },
  })
}

const skeleton = async (
  input: SkeletonFnInput<Context, Params>,
): Promise<SkeletonState> => {
  const { ctx, params } = input
  const feed = normalizeFeed(params.feed)
  const seenAt = params.seenAt ? Date.parse(params.seenAt) : undefined
  const delayedCursor = delayCursor(undefined, ctx.cfg.notificationsDelayMs)
  let cursor = params.cursor
  if (!cursor || Date.parse(cursor) > Date.parse(delayedCursor)) {
    cursor = delayedCursor
  }

  const items: NotificationItem[] = []
  let groups: NotificationGroup[] = []
  let nextCursor: string | undefined
  let itemsFetched = 0
  let rawLimit = MIN_RAW_LIMIT

  for (let read = 0; read < MAX_READS; read++) {
    const response = await ctx.hydrator.dataplane.getNotificationsV2({
      actorDid: params.hydrateCtx.viewer,
      feed,
      cursor,
      limit: rawLimit,
    })
    itemsFetched += response.notifications.length

    for (const notification of response.notifications) {
      const notif = parseRawNotification(notification)
      if (!notif) continue
      const uri = notif.uri
      const actorDid = uriToDid(uri)
      const indexedAt = notif.indexedAt
      // Hashing keeps IDs within the lexicon's length limit for long record URIs.
      const id = createHash('sha256')
        .update(`${indexedAt}\0${uri}`)
        .digest('base64url')

      let groupingKey: string = notif.reasonSubject || uri
      if (notif.reason === NOTIFICATION_REASON.FOLLOW) {
        groupingKey = NOTIFICATION_REASON.FOLLOW
      }
      if (notif.reason === NOTIFICATION_REASON.SUBSCRIBED_POST) {
        groupingKey = actorDid
      }

      items.push({
        raw: notif,
        id,
        groupingKey,
        actorDid,
      })
    }

    const groupingResult = buildGroups(
      items,
      params.limit,
      params.utcOffset,
      seenAt,
      ctx.cfg.notificationsV2Algorithm,
      feed,
    )
    groups = groupingResult.groups

    // After fetching a page from the dataplane and attempting to group, 2 situations can happen:
    // 1. The first unconsumed notification would create an additional group beyond params.limit.
    //    result.cursor points before that notification; use it so the next request processes it.
    // 2. Every fetched notification was consumed into the groups.
    //    result.cursor is undefined, so use response.cursor to fetch the next dataplane page.
    nextCursor = groupingResult.cursor ?? (response.cursor || undefined)

    const groupingFoundUnconsumedNotification =
      groupingResult.cursor !== undefined
    const dataplaneHasMoreNotifications = !!response.cursor
    const shouldContinueBuildingPage =
      !groupingFoundUnconsumedNotification && dataplaneHasMoreNotifications
    if (!shouldContinueBuildingPage) break

    cursor = response.cursor
    rawLimit = getNextRawLimit(itemsFetched, groups.length, params.limit)
    if (rawLimit === 0) break
  }

  return buildSpotlight(items, groups, nextCursor, params.limit, seenAt)
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const notifs = skeleton.groups.flatMap((group) =>
    group.items.map((item) => item.raw),
  )
  return ctx.hydrator.hydrateGroupedNotifications(notifs, params.hydrateCtx)
}

const rules = (
  input: RulesFnInput<Context, Params, SkeletonState>,
): SkeletonState => {
  const { ctx, params, skeleton, hydration } = input
  const seenAt = params.seenAt ? Date.parse(params.seenAt) : undefined
  const groups = mapDefined(
    skeleton.groups,
    (group): NotificationGroup | undefined => {
      const items = group.items.filter((item) => {
        const notif = item.raw
        const uri = notif.uri
        const did = item.actorDid
        if (
          ctx.views.viewerBlockExists(did, hydration) ||
          ctx.views.viewerMuteExists(did, hydration)
        ) {
          return false
        }
        if (
          shouldFilterReplyByThreadgate(
            notif.reason,
            uri,
            params.hydrateCtx.viewer,
            hydration,
            ctx.views,
          )
        ) {
          return false
        }
        if (
          shouldFilterHiddenThreadTag(
            notif.reason,
            uri,
            did,
            hydration,
            ctx.cfg.threadTagsHide,
          )
        ) {
          return false
        }
        if (
          shouldFilterForNeedsReview(
            notif.reason,
            did,
            uri,
            hydration,
            ctx.views,
          )
        ) {
          return false
        }

        // After hydration, notificationAvailable checks whether each notification’s required records exist.
        // If its actor, post, repost, follow, or starter pack is missing or blocked, rules removes that notification from the returned group.
        return notificationAvailable(notif, hydration, ctx.views)
      })

      const newest = items[0]
      const oldest = items.at(-1)

      // If it has no more elements, drop this group.
      if (!newest || !oldest) return

      // Filtering may remove notifications from this group; build a new group with only the remaining items and their updated metadata.
      return {
        ...group,
        id: newest.id,
        items,
        actorDids: items.map((item) => item.actorDid),
        itemCount: items.length,
        indexedAt: newest.raw.indexedAt,
        firstIndexedAt: oldest.raw.indexedAt,
        isRead: isNotificationRead(newest.raw.indexedAt, seenAt),
      }
    },
  )

  groups.sort(compareNotificationGroupsNewestFirst)

  return { ...skeleton, groups }
}

// Checks that the notification’s actor and required records exist and referenced posts aren’t viewer-blocked.
const notificationAvailable = (
  notif: RawNotification,
  state: HydrationState,
  views: Views,
): boolean => {
  const uri = notif.uri
  const actor = state.actors?.get(uriToDid(uri))
  if (!actor) return false

  const postAvailable = (postUri: AtUriString) =>
    !!state.posts?.get(postUri) &&
    !!state.actors?.get(uriToDid(postUri)) &&
    !views.viewerBlockExists(uriToDid(postUri), state)

  const starterPackAvailable = (starterPackUri: AtUriString) =>
    !!state.starterPacks?.get(starterPackUri) &&
    !!state.actors?.get(uriToDid(starterPackUri))

  switch (notif.reason) {
    case NOTIFICATION_REASON.LIKE: {
      const subjectUri = notif.reasonSubject
      if (!state.likes?.get(uri)) return false
      if (new AtUri(subjectUri).collection === app.bsky.feed.generator.$type) {
        return (
          !!state.feedgens?.get(subjectUri) &&
          !!state.actors?.get(uriToDid(subjectUri))
        )
      }
      return postAvailable(subjectUri)
    }
    case NOTIFICATION_REASON.REPOST:
      return !!state.reposts?.get(uri) && postAvailable(notif.reasonSubject)
    case NOTIFICATION_REASON.LIKE_VIA_REPOST:
    case NOTIFICATION_REASON.REPOST_VIA_REPOST: {
      const recordInfo =
        notif.reason === NOTIFICATION_REASON.LIKE_VIA_REPOST
          ? state.likes?.get(uri)
          : state.reposts?.get(uri)
      const postUri = state.reposts?.get(notif.reasonSubject)?.record.subject
        .uri
      return !!recordInfo && !!postUri && postAvailable(postUri)
    }
    case NOTIFICATION_REASON.FOLLOW:
    case NOTIFICATION_REASON.FOLLOW_BACK:
      return !!state.follows?.get(uri)
    case NOTIFICATION_REASON.REPLY:
      return (
        postAvailable(uri) && !!state.posts?.get(uri)?.record.reply?.parent.uri
      )
    case NOTIFICATION_REASON.QUOTE:
    case NOTIFICATION_REASON.MENTION:
    case NOTIFICATION_REASON.SUBSCRIBED_POST:
      return postAvailable(uri)
    case NOTIFICATION_REASON.VERIFIED:
    case NOTIFICATION_REASON.UNVERIFIED:
      // Both notifications survive deletion of the verification record.
      return true
    case NOTIFICATION_REASON.STARTERPACK_JOINED:
      return (
        !!actor.profile &&
        !!actor.profileCid &&
        starterPackAvailable(notif.reasonSubject)
      )
    case NOTIFICATION_REASON.CONTACT_MATCH:
      return !!actor.profile && !!actor.profileCid
    default:
      return false
  }
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
): app.bsky.notification.getGroupedNotifications.$OutputBody => {
  const { ctx, params, skeleton, hydration } = input
  const defs = app.bsky.notification.getGroupedNotifications
  const groups = mapDefined(skeleton.groups, (group) =>
    ctx.views.notificationGroup(group, hydration),
  )
  const profileDids = new Set<DidString>()
  const recordUris = new Set<AtUriString>()
  for (const { kind } of groups) {
    if (
      defs.likeGroup.$isTypeOf(kind) ||
      defs.repostGroup.$isTypeOf(kind) ||
      defs.likeViaRepostGroup.$isTypeOf(kind) ||
      defs.repostViaRepostGroup.$isTypeOf(kind)
    ) {
      recordUris.add(kind.post)
      for (const item of truncateRelatedViewsItems(kind.items)) {
        profileDids.add(item.actor)
      }
    } else if (defs.multiPostLikeGroup.$isTypeOf(kind)) {
      profileDids.add(kind.actor)
      for (const item of truncateRelatedViewsItems(kind.items)) {
        recordUris.add(item.post)
      }
    } else if (defs.generatorLikeGroup.$isTypeOf(kind)) {
      recordUris.add(kind.generator)
      for (const item of truncateRelatedViewsItems(kind.items)) {
        profileDids.add(item.actor)
      }
    } else if (defs.followGroup.$isTypeOf(kind)) {
      for (const item of truncateRelatedViewsItems(kind.items)) {
        profileDids.add(item.actor)
        if (item.starterPack) recordUris.add(item.starterPack)
      }
    } else if (defs.subscribedPostGroup.$isTypeOf(kind)) {
      for (const item of truncateRelatedViewsItems(kind.items)) {
        profileDids.add(item.actor)
        recordUris.add(item.post)
      }
    } else if (
      defs.replyNotification.$isTypeOf(kind) ||
      defs.quoteNotification.$isTypeOf(kind) ||
      defs.mentionNotification.$isTypeOf(kind)
    ) {
      recordUris.add(kind.post)
      if (kind.parent) recordUris.add(kind.parent)
    } else if (
      defs.followBackNotification.$isTypeOf(kind) ||
      defs.starterPackJoinedNotification.$isTypeOf(kind)
    ) {
      profileDids.add(kind.actor)
      if (kind.starterPack) recordUris.add(kind.starterPack)
    } else if (
      defs.verifiedNotification.$isTypeOf(kind) ||
      defs.unverifiedNotification.$isTypeOf(kind) ||
      defs.contactMatchNotification.$isTypeOf(kind)
    ) {
      profileDids.add(kind.actor)
    }
  }
  return {
    groups,
    relatedProfileViews: Object.fromEntries(
      mapDefined([...profileDids], (did) => {
        const view = ctx.views.profileDetailed(did, hydration)
        if (!view) return
        return [did, app.bsky.actor.defs.profileViewDetailed.$build(view)]
      }),
    ),
    relatedRecordViews: Object.fromEntries(
      mapDefined([...recordUris], (uri) => {
        const collection = new AtUri(uri).collection
        if (collection === app.bsky.feed.post.$type) {
          const view = ctx.views.maybePost(uri, hydration)
          if (!view) return
          return [uri, view]
        } else if (collection === app.bsky.graph.starterpack.$type) {
          const view = ctx.views.starterPack(uri, hydration)
          if (!view) return
          return [uri, app.bsky.graph.defs.starterPackView.$build(view)]
        } else if (collection === app.bsky.feed.generator.$type) {
          const view = ctx.views.feedGenerator(uri, hydration)
          if (!view) return
          return [uri, app.bsky.feed.defs.generatorView.$build(view)]
        }
      }),
    ),
    cursor: skeleton.cursor,
    seenAt: params.seenAt,
  }
}

const truncateRelatedViewsItems = <T extends unknown[]>(
  items: T,
): T[number][] => items.slice(0, MAX_GROUP_ITEMS_WITH_RELATED_VIEWS)

const normalizeFeed = (feed: string): NotificationFeed => {
  switch (feed) {
    case 'people-i-follow':
      return NotificationFeed.PEOPLE_I_FOLLOW
    case 'conversations':
      return NotificationFeed.CONVERSATIONS
    case 'followers':
      return NotificationFeed.FOLLOWERS
    case 'activity':
      return NotificationFeed.ACTIVITY
    default:
      return NotificationFeed.ALL
  }
}

type Context = {
  hydrator: Hydrator
  views: Views
  cfg: ServerConfig
}

type Params = app.bsky.notification.getGroupedNotifications.$Params & {
  hydrateCtx: HydrateCtxWithViewer
  seenAt?: DatetimeString
}

type SkeletonState = {
  groups: NotificationGroup[]
  cursor?: string
}
