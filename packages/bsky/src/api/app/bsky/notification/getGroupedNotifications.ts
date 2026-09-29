import type { AtUriString, DidString } from '@atproto/lex'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import {
  type HydrationState,
  mergeStates,
} from '../../../../hydration/hydrator.js'
import { app } from '../../../../lexicons/index.js'
import { NotificationFeed } from '../../../../proto/bsky_pb.js'
import { uriToDid } from '../../../../util/uris.js'
import { resHeaders } from '../../../util.js'
import { NOTIFICATION_REASON, type NotificationReason } from './constants.js'
import {
  type NotificationGroupingEvent,
  buildGroups,
} from './grouping/grouping.js'
import {
  delayCursor,
  shouldFilterForNeedsReview,
  shouldFilterHiddenThreadTag,
  shouldFilterReplyByThreadgate,
} from './util.js'

const RAW_LIMIT = 1000

const normalizeFeed = (feed: string | undefined): NotificationFeed => {
  switch (feed) {
    case 'people-i-follow':
      return NotificationFeed.PEOPLE_I_FOLLOW
    case 'conversations':
      return NotificationFeed.CONVERSATIONS
    case 'followers':
      return NotificationFeed.FOLLOWERS
    case 'activity':
      return NotificationFeed.ACTIVITY
    case 'all':
    default:
      return NotificationFeed.ALL
  }
}

const timestampToIsoString = (timestamp: {
  seconds: bigint | number
  nanos: number
}) => {
  const wholeSeconds = new Date(Number(timestamp.seconds) * 1000)
    .toISOString()
    .slice(0, 19)
  const fractionalSeconds = timestamp.nanos
    ? `.${String(timestamp.nanos).padStart(9, '0').replace(/0+$/, '')}`
    : ''
  return `${wholeSeconds}${fractionalSeconds}Z`
}

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.notification.getGroupedNotifications, {
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss as DidString
      const feed = normalizeFeed(params.feed)
      const utcOffset = params.utcOffset ?? 0
      const limit = params.limit ?? 30
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
      const seenAt = lastSeenRes?.timestamp
        ? timestampToIsoString(lastSeenRes.timestamp)
        : undefined
      const delayedCursor = delayCursor(
        params.cursor,
        ctx.cfg.notificationsDelayMs,
      )
      const response = await ctx.hydrator.dataplane.getNotificationsV2({
        actorDid: viewer,
        feed,
        cursor: delayedCursor,
        limit: RAW_LIMIT,
      })
      const raw = response.notifications
      let hydration = await ctx.hydrator.hydrateNotifications(raw, hydrateCtx)
      const repostUris = raw
        .filter(
          (notif) =>
            notif.reason === NOTIFICATION_REASON.LIKE_VIA_REPOST ||
            notif.reason === NOTIFICATION_REASON.REPOST_VIA_REPOST,
        )
        .map((notif) => notif.reasonSubject as AtUriString)
      const feedGeneratorUris = raw
        .filter(
          (notif) =>
            notif.reason === NOTIFICATION_REASON.LIKE &&
            notif.reasonSubject?.includes('app.bsky.feed.generator'),
        )
        .map((notif) => notif.reasonSubject as AtUriString)
      const [repostState, feedGeneratorState] = await Promise.all([
        repostUris.length
          ? ctx.hydrator.hydrateReposts(repostUris, hydrateCtx)
          : Promise.resolve({} as HydrationState),
        feedGeneratorUris.length
          ? ctx.hydrator.hydrateFeedGens(feedGeneratorUris, hydrateCtx)
          : Promise.resolve({} as HydrationState),
      ])
      const repostPostUris = repostUris.flatMap((uri) => {
        const subject = repostState.reposts?.get(uri)?.record.subject.uri
        return subject ? [subject] : []
      })
      const repostPostState = repostPostUris.length
        ? await ctx.hydrator.hydratePosts(
            repostPostUris.map((uri) => ({ uri })),
            hydrateCtx,
          )
        : ({} as HydrationState)
      hydration = mergeStates(
        hydration,
        mergeStates(
          repostState,
          mergeStates(repostPostState, feedGeneratorState),
        ),
      )
      const visible = raw.filter((notif) => {
        const uri = notif.uri as AtUriString
        const did = uriToDid(uri)
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
            viewer,
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

        return true
      })
      const notificationViews = new Map(
        visible.flatMap((notif) => {
          const view = ctx.views.notification(notif, seenAt, hydration)
          return view ? [[notif.uri, view] as const] : []
        }),
      )
      const groupableNotifications = visible.filter((notif) =>
        notificationViews.has(notif.uri),
      )
      const events: NotificationGroupingEvent[] = groupableNotifications.map(
        (notif) => {
          const uri = notif.uri as AtUriString
          const did = uriToDid(uri)
          const indexedAt = timestampToIsoString(notif.timestamp!)
          const id = Buffer.from(`${indexedAt}\0${uri}`).toString('base64url')
          const view = notificationViews.get(notif.uri)
          let subject = notif.reasonSubject || uri
          if (
            notif.reason === NOTIFICATION_REASON.LIKE_VIA_REPOST ||
            notif.reason === NOTIFICATION_REASON.REPOST_VIA_REPOST
          ) {
            subject =
              hydration.reposts?.get(subject as AtUriString)?.record.subject
                .uri ?? subject
          }
          if (notif.reason === NOTIFICATION_REASON.SUBSCRIBED_POST)
            subject = did
          if (notif.reason === NOTIFICATION_REASON.FOLLOW_BACK) {
            subject = NOTIFICATION_REASON.FOLLOW_BACK
          } else if (notif.reason === NOTIFICATION_REASON.FOLLOW) {
            subject = view?.starterPack?.uri ?? NOTIFICATION_REASON.FOLLOW
          }
          return {
            id,
            kind: notif.reason as NotificationReason,
            subject,
            actorDid: did,
            indexedAt: indexedAt as NotificationGroupingEvent['indexedAt'],
          }
        },
      )
      const notificationByEventId = new Map(
        events.map((event, index) => [
          event.id,
          groupableNotifications[index]!,
        ]),
      )
      const result = buildGroups(
        events,
        limit,
        utcOffset,
        seenAt ? Date.parse(seenAt) : undefined,
        ctx.cfg.notificationsV2Algorithm,
        feed,
      )
      const emittedMultiPostLikes = new Set<DidString>()
      const groups: unknown[] = result.groups.flatMap((group): unknown[] => {
        const notif = notificationByEventId.get(group.id)
        const item = notif && notificationViews.get(notif.uri)
        if (!item) return []
        const common = {
          id: group.id,
          isRead: group.isRead,
          indexedAt: group.indexedAt,
        }
        const count = group.eventCount
        const actors = group.actorDids
          .slice(0, 10)
          .map((did) => ctx.views.profile(did, hydration))
          .filter((profile) => profile !== undefined)
        const targetPost = (uri: string) =>
          ctx.views.maybePost(uri as AtUriString, hydration)

        if (group.kind === NOTIFICATION_REASON.LIKE) {
          const target = group.subject as AtUriString
          if (target.includes('app.bsky.feed.generator')) {
            const generator = ctx.views.feedGenerator(target, hydration)
            return generator
              ? [
                  {
                    $type:
                      'app.bsky.notification.getGroupedNotifications#generatorLikeGroup',
                    ...common,
                    count,
                    generator,
                    actors,
                  },
                ]
              : []
          }
          const actorDid = group.actorDids[0]
          if (
            group.eventCount === 1 &&
            actorDid &&
            !emittedMultiPostLikes.has(actorDid)
          ) {
            const multiPostGroups = result.groups.filter(
              (candidate) =>
                candidate.kind === NOTIFICATION_REASON.LIKE &&
                candidate.eventCount === 1 &&
                candidate.actorDids[0] === actorDid &&
                !candidate.subject.includes('app.bsky.feed.generator'),
            )
            if (multiPostGroups.length > 1) {
              emittedMultiPostLikes.add(actorDid)
              const postUris = multiPostGroups.map(
                ({ subject }) => subject as AtUriString,
              )
              const posts = postUris
                .map((uri) => ctx.views.post(uri, hydration))
                .filter((post) => post !== undefined)
              const actor = ctx.views.profile(actorDid, hydration)
              if (actor && posts.length > 1) {
                return [
                  {
                    $type:
                      'app.bsky.notification.getGroupedNotifications#multiPostLikeGroup',
                    ...common,
                    actor,
                    posts,
                    postUris,
                    count: multiPostGroups.length,
                  },
                ]
              }
            }
          } else if (
            actorDid &&
            emittedMultiPostLikes.has(actorDid) &&
            group.eventCount === 1
          ) {
            return []
          }
          const post = ctx.views.post(target, hydration)
          return post
            ? [
                {
                  $type:
                    'app.bsky.notification.getGroupedNotifications#likeGroup',
                  ...common,
                  count,
                  post,
                  actors,
                },
              ]
            : []
        }
        if (
          group.kind === NOTIFICATION_REASON.REPOST ||
          group.kind === NOTIFICATION_REASON.LIKE_VIA_REPOST ||
          group.kind === NOTIFICATION_REASON.REPOST_VIA_REPOST
        ) {
          const post = ctx.views.post(group.subject as AtUriString, hydration)
          if (!post) return []
          const type =
            group.kind === NOTIFICATION_REASON.REPOST
              ? 'repostGroup'
              : group.kind === NOTIFICATION_REASON.LIKE_VIA_REPOST
                ? 'likeViaRepostGroup'
                : 'repostViaRepostGroup'
          return [
            {
              $type: `app.bsky.notification.getGroupedNotifications#${type}`,
              ...common,
              count,
              post,
              actors,
            },
          ]
        }
        if (group.kind === NOTIFICATION_REASON.FOLLOW_BACK) {
          return [
            {
              $type:
                'app.bsky.notification.getGroupedNotifications#followBackNotification',
              id: group.id,
              isRead: group.isRead,
              indexedAt: group.indexedAt,
              actor: actors[0],
            },
          ]
        }
        if (group.kind === NOTIFICATION_REASON.FOLLOW) {
          const followedBack =
            group.actorDids.length === 1 && !!actors[0]?.viewer?.following
          if (followedBack) {
            return [
              {
                $type:
                  'app.bsky.notification.getGroupedNotifications#followBackNotification',
                id: group.id,
                isRead: group.isRead,
                indexedAt: group.indexedAt,
                actor: actors[0],
              },
            ]
          }
          const starterPack = item.starterPack
          return [
            {
              $type:
                'app.bsky.notification.getGroupedNotifications#followGroup',
              ...common,
              count,
              actors,
              starterPack,
            },
          ]
        }
        if (group.kind === NOTIFICATION_REASON.SUBSCRIBED_POST) {
          const postUris = group.items.flatMap(({ id }) => {
            const eventNotif = notificationByEventId.get(id)
            return eventNotif ? [eventNotif.uri as AtUriString] : []
          })
          const posts = postUris
            .map((uri) => ctx.views.post(uri, hydration))
            .filter((post) => post !== undefined)
          return posts.length
            ? [
                {
                  $type:
                    'app.bsky.notification.getGroupedNotifications#subscribedPostGroup',
                  ...common,
                  actor: item.author,
                  posts,
                  postUris,
                  count,
                },
              ]
            : []
        }
        if (
          group.kind === NOTIFICATION_REASON.REPLY ||
          group.kind === NOTIFICATION_REASON.QUOTE ||
          group.kind === NOTIFICATION_REASON.MENTION
        ) {
          const post = ctx.views.post(item.uri, hydration)
          if (!post) return []
          const record = hydration.posts?.get(item.uri)?.record
          const parentUri = record?.reply?.parent.uri
          const parent = parentUri ? targetPost(parentUri) : undefined
          const type =
            group.kind === NOTIFICATION_REASON.REPLY
              ? 'replyNotification'
              : group.kind === NOTIFICATION_REASON.QUOTE
                ? 'quoteNotification'
                : 'mentionNotification'
          return [
            {
              $type: `app.bsky.notification.getGroupedNotifications#${type}`,
              id: group.id,
              isRead: group.isRead,
              indexedAt: group.indexedAt,
              post,
              ...(group.kind === NOTIFICATION_REASON.REPLY
                ? {
                    parent:
                      parent ??
                      ctx.views.notFoundPost(
                        (parentUri ?? item.uri) as AtUriString,
                      ),
                  }
                : parent
                  ? { parent }
                  : {}),
            },
          ]
        }
        const typeByKind: Record<string, string> = {
          [NOTIFICATION_REASON.VERIFIED]: 'verifiedNotification',
          [NOTIFICATION_REASON.UNVERIFIED]: 'unverifiedNotification',
          [NOTIFICATION_REASON.STARTERPACK_JOINED]:
            'starterPackJoinedNotification',
          [NOTIFICATION_REASON.CONTACT_MATCH]: 'contactMatchNotification',
        }
        const type = typeByKind[group.kind]
        if (!type) return []
        if (
          group.kind === NOTIFICATION_REASON.STARTERPACK_JOINED &&
          !item.starterPack
        ) {
          return []
        }
        return [
          {
            $type: `app.bsky.notification.getGroupedNotifications#${type}`,
            id: group.id,
            isRead: group.isRead,
            indexedAt: group.indexedAt,
            actor: item.author,
            ...(group.kind === NOTIFICATION_REASON.STARTERPACK_JOINED &&
            item.starterPack
              ? { starterPack: item.starterPack }
              : {}),
          },
        ]
      })
      const cursor = result.cursor ?? response.cursor ?? undefined
      return {
        encoding: 'application/json',
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
        body: {
          groups:
            groups as unknown as app.bsky.notification.getGroupedNotifications.$OutputBody['groups'],
          cursor,
          seenAt:
            seenAt as app.bsky.notification.getGroupedNotifications.$OutputBody['seenAt'],
        },
      }
    },
  })
}
