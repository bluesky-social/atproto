import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { Code, isDataplaneError } from '../../../../data-plane/index'
import { Server } from '../../../../lexicon/index'
import { isNotFoundPost } from '../../../../lexicon/types/app/bsky/feed/defs'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/feed/getPostThread'
import {
  HydrationFn,
  noRules,
  PresentationFn,
  SkeletonFn,
} from '../../../../pipeline'
import { postUriToThreadgateUri } from '../../../../util/uris'

type Skeleton = {
  anchor: string
  uris: string[]
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getPostThread({
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noRules, // handled in presentation: 3p block-violating replies are turned to #blockedPost, viewer blocks turned to #notFoundPost.
      presentation,
      {
        exposeRepoRev: true,
        include3pBlocks: true,
        includeTakedowns: true,
      },
    ),
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async (ctx) => {
  const { params } = ctx

  const anchor = await ctx.hydrator.resolveUri(params.uri)
  try {
    const res = await ctx.dataplane.getThread({
      postUri: anchor,
      above: params.parentHeight,
      below: params.depth,
    })
    return {
      anchor,
      uris: res.uris,
    }
  } catch (err) {
    if (isDataplaneError(err, Code.NotFound)) {
      return {
        anchor,
        uris: [],
      }
    } else {
      throw err
    }
  }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async (ctx, skeleton) => {
  return ctx.hydrator.hydrateThreadPosts(
    skeleton.uris.map((uri) => ({ uri })),
    ctx,
  )
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = (
  ctx,
  skeleton,
  hydration,
) => {
  const thread = ctx.views.thread(skeleton, hydration, {
    height: ctx.params.parentHeight,
    depth: ctx.params.depth,
  })
  if (isNotFoundPost(thread)) {
    // @TODO technically this could be returned as a NotFoundPost based on lexicon
    throw new InvalidRequestError(
      `Post not found: ${skeleton.anchor}`,
      'NotFound',
    )
  }
  const rootUri =
    hydration.posts?.get(skeleton.anchor)?.record.reply?.root.uri ??
    skeleton.anchor
  const threadgate = ctx.views.threadgate(
    postUriToThreadgateUri(rootUri),
    hydration,
  )

  return { body: { thread, threadgate } }
}
