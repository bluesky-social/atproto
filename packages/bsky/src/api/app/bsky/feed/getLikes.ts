import { mapDefined } from '@atproto/common'
import { normalizeDatetimeAlways } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { parseString } from '../../../../hydration/util'
import { Server } from '../../../../lexicon/index'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/feed/getLikes'
import {
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from '../../../../pipeline'
import { uriToDid as creatorFromUri } from '../../../../util/uris'
import { clearlyBadCursor } from '../../../util'

type Skeleton = {
  likes: string[]
  cursor?: string
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getLikes({
    auth: ctx.authVerifier.standardOptional,
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noBlocks,
      presentation,
      {
        includeTakedowns: true,
      },
    ),
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async (ctx) => {
  if (clearlyBadCursor(ctx.params.cursor)) {
    return { likes: [] }
  }
  if (looksLikeNonSortedCursor(ctx.params.cursor)) {
    throw new InvalidRequestError(
      'Cursor appear to be out of date, please try reloading.',
    )
  }
  const likesRes = await ctx.hydrator.dataplane.getLikesBySubjectSorted({
    subject: { uri: ctx.params.uri, cid: ctx.params.cid },
    cursor: ctx.params.cursor,
    limit: ctx.params.limit,
  })
  return {
    likes: likesRes.uris,
    cursor: parseString(likesRes.cursor),
  }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async (ctx, skeleton) => {
  return ctx.hydrator.hydrateLikes(skeleton.likes, ctx)
}

const noBlocks: RulesFn<Skeleton, QueryParams> = (ctx, skeleton, hydration) => {
  skeleton.likes = skeleton.likes.filter((uri) => {
    const creator = creatorFromUri(uri)
    return !ctx.views.viewerBlockExists(creator, hydration)
  })
  return skeleton
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = (
  ctx,
  skeleton,
  hydration,
) => {
  const likeViews = mapDefined(skeleton.likes, (uri) => {
    const like = hydration.likes?.get(uri)
    if (!like || !like.record) {
      return
    }
    const creatorDid = creatorFromUri(uri)
    const actor = ctx.views.profile(creatorDid, hydration)
    if (!actor) {
      return
    }
    return {
      actor,
      createdAt: normalizeDatetimeAlways(like.record.createdAt),
      indexedAt: like.sortedAt.toISOString(),
    }
  })
  return {
    body: {
      likes: likeViews,
      cursor: skeleton.cursor,
      uri: ctx.params.uri,
      cid: ctx.params.cid,
    },
  }
}

const looksLikeNonSortedCursor = (cursor: string | undefined) => {
  // the old cursor values used with getLikesBySubject() were dids.
  // we now use getLikesBySubjectSorted(), whose cursors look like timestamps.
  return cursor?.startsWith('did:')
}
