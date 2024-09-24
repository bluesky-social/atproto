import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'

import AppContext from '../../../../context.js'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator.js'
import { Server } from '../../../../lexicon/index.js'
import { isRecord as isPostRecord } from '../../../../lexicon/types/app/bsky/feed/post.js'
import { QueryParams } from '../../../../lexicon/types/app/bsky/notification/listNotifications.js'
import {
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
} from '../../../../pipeline.js'
import { Notification } from '../../../../proto/bsky_pb.js'
import { uriToDid as didFromUri } from '../../../../util/uris.js'
import { Views } from '../../../../views/index.js'
import { clearlyBadCursor, resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  const listNotifications = ctx.createPipeline(
    skeleton,
    hydration,
    noBlockOrMutes,
    presentation,
  )
  server.app.bsky.notification.listNotifications({
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })
      const result = await listNotifications(hydrateCtx, params)
      return {
        encoding: 'application/json',
        body: result,
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}

const skeleton = async (
  input: SkeletonFnInput<Context, Params>,
): Promise<SkeletonState> => {
  const { params, ctx } = input
  if (params.seenAt) {
    throw new InvalidRequestError('The seenAt parameter is unsupported')
  }
  const viewer = ctx.hydrateCtx.viewer
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

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { skeleton, ctx } = input
  return ctx.hydrator.hydrateNotifications(skeleton.notifs, ctx.hydrateCtx)
}

const noBlockOrMutes = (
  input: RulesFnInput<Context, Params, SkeletonState>,
) => {
  const { skeleton, hydration, ctx } = input
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
          rootPostUri && didFromUri(rootPostUri) === ctx.hydrateCtx?.viewer
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

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { skeleton, hydration, ctx } = input
  const { notifs, lastSeenNotifs, cursor } = skeleton
  const notifications = mapDefined(notifs, (notif) =>
    ctx.views.notification(notif, lastSeenNotifs, hydration),
  )
  return {
    notifications,
    cursor,
    priority: skeleton.priority,
    seenAt: skeleton.lastSeenNotifs,
  }
}

type Context = {
  hydrator: Hydrator
  views: Views
  hydrateCtx: HydrateCtx & { viewer: string }
}

type Params = QueryParams

type SkeletonState = {
  notifs: Notification[]
  priority: boolean
  lastSeenNotifs?: string
  cursor?: string
}

const getPriority = async (ctx: Context, did: string) => {
  const actors = await ctx.hydrator.actor.getActors([did])
  return !!actors.get(did)?.priorityNotifications
}
