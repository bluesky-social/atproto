import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'

import AppContext from '../../../../context'
import { HydrateCtx } from '../../../../hydration/hydrate-ctx'
import { Server } from '../../../../lexicon/index'
import { isRecord as isPostRecord } from '../../../../lexicon/types/app/bsky/feed/post'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/notification/listNotifications'
import {
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from '../../../../pipeline'
import { Notification } from '../../../../proto/bsky_pb'
import { uriToDid as didFromUri } from '../../../../util/uris'
import { clearlyBadCursor } from '../../../util'

type Skeleton = {
  notifs: Notification[]
  priority: boolean
  lastSeenNotifs?: string
  cursor?: string
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.listNotifications({
    auth: ctx.authVerifier.standard,
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noBlockOrMutes,
      presentation,
    ),
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async ({ ctx, params }) => {
  if (params.seenAt) {
    throw new InvalidRequestError('The seenAt parameter is unsupported')
  }

  const { viewer } = ctx
  if (!viewer) throw new InvalidRequestError('An actor is required')

  const priority = params.priority ?? (await getPriority(ctx, viewer))
  if (clearlyBadCursor(params.cursor)) {
    return { notifs: [], priority }
  }
  const [res, lastSeenRes] = await Promise.all([
    ctx.hydrator.dataplane.getNotifications({
      actorDid: viewer,
      priority,
      cursor: params.cursor,
      limit: params.limit,
    }),
    ctx.hydrator.dataplane.getNotificationSeen({
      actorDid: viewer,
      priority,
    }),
  ])
  // @NOTE for the first page of results if there's no last-seen time, consider top notification unread
  // rather than all notifications. bit of a hack to be more graceful when seen times are out of sync.
  let lastSeenDate = lastSeenRes.timestamp?.toDate()
  if (!lastSeenDate && !params.cursor) {
    lastSeenDate = res.notifications.at(0)?.timestamp?.toDate()
  }
  return {
    notifs: res.notifications,
    cursor: res.cursor || undefined,
    priority,
    lastSeenNotifs: lastSeenDate?.toISOString(),
  }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async ({
  ctx,
  skeleton,
}) => {
  return ctx.hydrator.hydrateNotifications(skeleton.notifs, ctx)
}

const noBlockOrMutes: RulesFn<Skeleton, QueryParams> = ({
  ctx,
  skeleton,
  hydration,
}) => {
  skeleton.notifs = skeleton.notifs.filter((item) => {
    const did = didFromUri(item.uri)
    if (
      ctx.views.viewerBlockExists(did, hydration) ||
      ctx.views.viewerMuteExists(did, hydration)
    ) {
      return false
    }
    // Filter out hidden replies only if the viewer owns
    // the threadgate and they hid the reply.
    if (item.reason === 'reply') {
      const post = hydration.posts?.get(item.uri)
      if (post) {
        const rootPostUri = isPostRecord(post.record)
          ? post.record.reply?.root.uri
          : undefined
        const isRootPostByViewer =
          rootPostUri && didFromUri(rootPostUri) === ctx?.viewer
        const isHiddenReply = isRootPostByViewer
          ? ctx.views.replyIsHiddenByThreadgate(
              item.uri,
              rootPostUri,
              hydration,
            )
          : false
        if (isHiddenReply) {
          return false
        }
      }
    }
    return true
  })
  return skeleton
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = ({
  skeleton,
  hydration,
  ctx,
}) => {
  const { notifs, lastSeenNotifs, cursor } = skeleton
  const notifications = mapDefined(notifs, (notif) =>
    ctx.views.notification(notif, lastSeenNotifs, hydration),
  )
  return {
    body: {
      notifications,
      cursor,
      priority: skeleton.priority,
      seenAt: skeleton.lastSeenNotifs,
    },
  }
}

const getPriority = async (ctx: HydrateCtx, did: string) => {
  const actors = await ctx.hydrator.actor.getActors([did])
  return !!actors.get(did)?.priorityNotifications
}
