import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context.js'
import { Code, isDataplaneError } from '../../../../data-plane/index.js'
import { Server } from '../../../../lexicon/index.js'
import { isNotFoundPost } from '../../../../lexicon/types/app/bsky/feed/defs.js'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/feed/getPostThread.js'
import {
  HydrationFn,
  noRules,
  PresentationFn,
  SkeletonFn,
} from '../../../../pipeline.js'
import { postUriToThreadgateUri } from '../../../../util/uris.js'
import { ATPROTO_REPO_REV } from '../../../util.js'

type Skeleton = {
  anchor: string
  uris: string[]
}

export default function (server: Server, ctx: AppContext) {
  const getPostThread = ctx.createPipeline(
    skeleton,
    hydration,
    noRules, // handled in presentation: 3p block-violating replies are turned to #blockedPost, viewer blocks turned to #notFoundPost.
    presentation,
    { exposeRepoRev: true },
  )

  server.app.bsky.feed.getPostThread({
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: async ({ params, auth, req, res }) => {
      const { viewer, includeTakedowns, include3pBlocks } =
        ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)

      try {
        return await getPostThread(
          { labelers, viewer, includeTakedowns, include3pBlocks },
          params,
        )
      } catch (err) {
        const { hydrator } = await ctx.createRequestContent({
          labelers,
          viewer,
          includeTakedowns,
          include3pBlocks,
        })

        const repoRev = await hydrator.actor.getRepoRevSafe(viewer)
        if (repoRev) {
          res.setHeader(ATPROTO_REPO_REV, repoRev)
        }

        throw err
      }
    },
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
    ctx.hydrateCtx,
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
