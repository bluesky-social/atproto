import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { ServerConfig } from '../../../../config'
import { AppContext } from '../../../../context'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
import { Server } from '../../../../lexicon'
import { isRecord as isPostRecord } from '../../../../lexicon/types/app/bsky/feed/post'
import { QueryParams } from '../../../../lexicon/types/app/bsky/notification/listNotifications'
import {
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
  createPipeline,
} from '../../../../pipeline'
import { Notification } from '../../../../proto/bsky_pb'
import { uriToDid as didFromUri } from '../../../../util/uris'
import { Views } from '../../../../views'
import { resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const listNotifications = createPipeline(
    skeleton,
    hydration,
    noBlockOrMutesOrNeedsReview,
    presentation,
  )
  server.app.bsky.notification.listNotifications({
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })
      const result = await listNotifications(
        { ...params, hydrateCtx: hydrateCtx.copy({ viewer }) },
        ctx,
      )
      return {
        encoding: 'application/json',
        body: result,
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}

const paginateNotifications = async (opts: {
  ctx: Context
  priority: boolean
  reasons?: string[]
  cursor?: string
  limit: number
  viewer: string
}) => {
  const { ctx, priority, reasons, limit, viewer } = opts

  // if not filtering, then just pass through the response from dataplane
  if (!reasons) {
    const res = await ctx.hydrator.dataplane.getNotifications({
      actorDid: viewer,
      priority,
      cursor: opts.cursor,
      limit,
    })
    return {
      notifications: res.notifications,
      cursor: res.cursor,
    }
  }

  let nextCursor: string | undefined = opts.cursor
  let toReturn: Notification[] = []
  const maxAttempts = 10
  const attemptSize = Math.ceil(limit / 2)
  for (let i = 0; i < maxAttempts; i++) {
    const res = await ctx.hydrator.dataplane.getNotifications({
      actorDid: viewer,
      priority,
      cursor: nextCursor,
      limit,
    })
    const filtered = res.notifications.filter((notif) =>
      reasons.includes(notif.reason),
    )
    toReturn = [...toReturn, ...filtered]
    nextCursor = res.cursor ?? undefined
    if (toReturn.length >= attemptSize || !nextCursor) {
      break
    }
  }
  return {
    notifications: toReturn,
    cursor: nextCursor,
  }
}

/**
 * Applies a configurable delay to the datetime string of a cursor,
 * effectively allowing for a delay on listing the notifications.
 * This is useful to allow time for services to process notifications
 * before they are listed to the user.
 */
export const delayCursor = (
  cursorStr: string | undefined,
  delayMs: number,
): string => {
  const nowMinusDelay = Date.now() - delayMs
  if (cursorStr === undefined) return new Date(nowMinusDelay).toISOString()
  const cursor = new Date(cursorStr).getTime()
  if (isNaN(cursor)) return cursorStr
  return new Date(Math.min(cursor, nowMinusDelay)).toISOString()
}

const skeleton = async (
  input: SkeletonFnInput<Context, Params>,
): Promise<SkeletonState> => {
  const { params, ctx } = input
  if (params.seenAt) {
    throw new InvalidRequestError('The seenAt parameter is unsupported')
  }

  const originalCursor = params.cursor
  const delayedCursor = delayCursor(
    originalCursor,
    ctx.cfg.notificationsDelayMs,
  )
  const viewer = params.hydrateCtx.viewer
  const priority = params.priority ?? (await getPriority(ctx, viewer))
  const [res, lastSeenRes] = await Promise.all([
    paginateNotifications({
      ctx,
      priority,
      reasons: params.reasons,
      cursor: delayedCursor,
      limit: params.limit,
      viewer,
    }),
    ctx.hydrator.dataplane.getNotificationSeen({
      actorDid: viewer,
      priority,
    }),
  ])
  // @NOTE for the first page of results if there's no last-seen time, consider top notification unread
  // rather than all notifications. bit of a hack to be more graceful when seen times are out of sync.
  let lastSeenDate = lastSeenRes.timestamp?.toDate()
  if (!lastSeenDate && !originalCursor) {
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
  const { skeleton, params, ctx } = input
  return ctx.hydrator.hydrateNotifications(skeleton.notifs, params.hydrateCtx)
}

const noBlockOrMutesOrNeedsReview = (
  input: RulesFnInput<Context, Params, SkeletonState>,
) => {
  const { skeleton, hydration, ctx, params } = input
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
          rootPostUri && didFromUri(rootPostUri) === params.hydrateCtx?.viewer
        const isHiddenByThreadgate = isRootPostByViewer
          ? ctx.views.replyIsHiddenByThreadgate(
              item.uri,
              rootPostUri,
              hydration,
            )
          : false
        if (isHiddenByThreadgate) {
          return false
        }
      }
    }
    // Filter out notifications from users that need review unless moots
    if (
      item.reason === 'reply' ||
      item.reason === 'quote' ||
      item.reason === 'mention' ||
      item.reason === 'like' ||
      item.reason === 'follow'
    ) {
      if (!ctx.views.viewerSeesNeedsReview({ did, uri: item.uri }, hydration)) {
        return false
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
  cfg: ServerConfig
}

type Params = QueryParams & {
  hydrateCtx: HydrateCtx & { viewer: string }
}

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
