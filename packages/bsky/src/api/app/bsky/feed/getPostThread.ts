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
  createPipeline,
  HydrationFn,
  noRules,
  PresentationFn,
  SkeletonFn,
} from '../../../../pipeline'
import { postUriToThreadgateUri } from '../../../../util/uris'
import { ATPROTO_REPO_REV } from '../../../util'

type Skeleton = {
  anchor: string
  uris: string[]
}

export default function (server: Server, ctx: AppContext) {
  const getPostThread = createPipeline(
    skeleton,
    hydration,
    noRules, // handled in presentation: 3p block-violating replies are turned to #blockedPost, viewer blocks turned to #notFoundPost.
    presentation,
  )

  server.app.bsky.feed.getPostThread({
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: ctx.createHandler(
      async (ctx, reqCtx) => {
        try {
          return await getPostThread(ctx, reqCtx)
        } catch (err) {
          const { res } = reqCtx
          if (!res.headersSent && !res.hasHeader(ATPROTO_REPO_REV)) {
            const repoRev = await ctx.hydrator.actor.getRepoRevSafe(ctx.viewer)
            if (repoRev) {
              res.setHeader(ATPROTO_REPO_REV, repoRev)
            }
          }

          throw err
        }
      },
      {
        exposeRepoRev: true,
        enforceInclude3pBlocks: true,
        enforceIncludeTakedowns: true,
      },
    ),
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async ({ ctx, params }) => {
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

const hydration: HydrationFn<Skeleton, QueryParams> = async ({
  ctx,
  skeleton,
}) => {
  return ctx.hydrator.hydrateThreadPosts(
    skeleton.uris.map((uri) => ({ uri })),
    ctx,
  )
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = ({
  ctx,
  params,
  skeleton,
  hydration,
}) => {
  const thread = ctx.views.thread(skeleton, hydration, {
    height: params.parentHeight,
    depth: params.depth,
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

  return { thread, threadgate }
}
