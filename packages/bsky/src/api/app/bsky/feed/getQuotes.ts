import { mapDefined } from '@atproto/common'
import AppContext from '../../../../context'
import { parseString } from '../../../../hydration/util'
import { Server } from '../../../../lexicon'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/feed/getQuotes'
import {
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from '../../../../pipeline'
import { uriToDid } from '../../../../util/uris'
import { clearlyBadCursor } from '../../../util'

type Skeleton = {
  uris: string[]
  cursor?: string
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getQuotes({
    auth: ctx.authVerifier.standardOptional,
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noBlocks,
      presentation,
      { allowIncludeTakedowns: true },
    ),
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async ({ ctx, params }) => {
  if (clearlyBadCursor(params.cursor)) {
    return { uris: [] }
  }
  const quotesRes = await ctx.hydrator.dataplane.getQuotesBySubjectSorted({
    subject: { uri: params.uri, cid: params.cid },
    cursor: params.cursor,
    limit: params.limit,
  })
  return {
    uris: quotesRes.uris,
    cursor: parseString(quotesRes.cursor),
  }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async ({
  ctx,
  skeleton,
}) => {
  return ctx.hydrator.hydratePosts(
    skeleton.uris.map((uri) => ({ uri })),
    ctx,
  )
}

const noBlocks: RulesFn<Skeleton, QueryParams> = ({
  ctx,
  skeleton,
  hydration,
}) => {
  skeleton.uris = skeleton.uris.filter((uri) => {
    const embedBlock = hydration.postBlocks?.get(uri)?.embed
    const authorDid = uriToDid(uri)
    return !ctx.views.viewerBlockExists(authorDid, hydration) && !embedBlock
  })
  return skeleton
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = ({
  ctx,
  skeleton,
  hydration,
  params,
}) => {
  const postViews = mapDefined(skeleton.uris, (uri) => {
    return ctx.views.post(uri, hydration)
  })
  return {
    body: {
      posts: postViews,
      cursor: skeleton.cursor,
      uri: params.uri,
      cid: params.cid,
    },
  }
}
