import type { Server } from '@atproto/xrpc-server'
import { InternalServerError, InvalidRequestError } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import type { Post, PostAgg } from '../../../../hydration/feed.js'
import type {
  HydrateCtx,
  HydrationState,
  Hydrator,
} from '../../../../hydration/hydrator.js'
import {
  HydrationMap,
  parseDate,
  parseRecord,
} from '../../../../hydration/util.js'
import { app } from '../../../../lexicons/index.js'
import { createPipeline, noRules } from '../../../../pipeline.js'
import type { Record } from '../../../../proto/bsky_pb.js'
import { recordUriOf } from '../../../../util/uris.js'
import type { Views } from '../../../../views/index.js'
import { resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  const getPostVersions = createPipeline(
    skeleton,
    hydration,
    noRules,
    presentation,
  )
  server.add(app.bsky.feed.getPostVersions, {
    auth: ctx.authVerifier.standardReadOrRoleOptional,
    handler: async ({ params, auth, req }) => {
      const { viewer, includeTakedowns, skipViewerBlocks } =
        ctx.authVerifier.parseCreds(auth)
      const hydrateCtx = await ctx.hydrator.createContext({
        xrpcEndpoint: app.bsky.feed.getPostVersions.$lxm,
        labelers: ctx.reqLabelers(req),
        viewer,
        includeTakedowns,
        skipViewerBlocks,
      })
      const body = await getPostVersions({ ...params, hydrateCtx }, ctx)
      return {
        encoding: 'application/json',
        body,
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}

const skeleton = async ({ ctx, params }: { ctx: Context; params: Params }) => {
  const uri = recordUriOf(params.uri, app.bsky.feed.post.$type)
  if (!uri) throw notFound()

  const response = await ctx.hydrator.dataplane.getPostVersions({ uri })
  const current = postFromRecord(response.versions[0], params.hydrateCtx)
  if (!current) throw notFound()

  const versions = [current]
  for (const record of response.versions.slice(1)) {
    const version = postFromRecord(record, params.hydrateCtx)
    if (!version) {
      throw new InternalServerError('Stored post version is invalid')
    }
    versions.push(version)
  }
  return { uri, versions } satisfies Skeleton
}

const hydration = async ({
  ctx,
  params,
  skeleton,
}: {
  ctx: Context
  params: Params
  skeleton: Skeleton
}): Promise<HydrationState> => {
  const [state, response] = await Promise.all([
    ctx.hydrator.hydratePosts([{ uri: skeleton.uri }], params.hydrateCtx),
    ctx.hydrator.dataplane.getPostVersionCounts({
      refs: skeleton.versions.map((version) => ({
        uri: skeleton.uri,
        cid: version.cid,
      })),
    }),
  ])
  if (response.counts.length !== skeleton.versions.length) {
    throw new InternalServerError('Post version counts are incomplete')
  }
  skeleton.counts = response.counts.map((count) => ({
    likes: count.likes,
    reposts: count.reposts,
    replies: count.replies,
    quotes: count.quotes,
    bookmarks: count.bookmarks,
  }))
  return state
}

const presentation = ({
  ctx,
  skeleton,
  hydration,
}: {
  ctx: Context
  skeleton: Skeleton
  hydration: HydrationState
}): app.bsky.feed.getPostVersions.$OutputBody => {
  if (!skeleton.counts) {
    throw new InternalServerError('Post version counts are missing')
  }

  const canonical = hydration.posts?.get(skeleton.uri)
  if (!canonical) throw notFound()

  const versions = skeleton.versions.map((version, index) => {
    const posts = new HydrationMap(hydration.posts)
    posts.set(skeleton.uri, {
      ...canonical,
      record: version.record,
      cid: version.cid,
      editedAt: version.editedAt,
    })
    const postAggs = new HydrationMap(hydration.postAggs)
    postAggs.set(skeleton.uri, skeleton.counts?.[index] ?? null)
    const view = ctx.views.post(skeleton.uri, {
      ...hydration,
      posts,
      postAggs,
      postViewCounts: undefined,
    })
    if (!view) throw notFound()

    const { viewCount: _viewCount, viewer, ...rest } = view
    if (!viewer) return rest
    const {
      like: _like,
      repost: _repost,
      bookmarked: _bookmarked,
      ...uriViewer
    } = viewer
    return { ...rest, viewer: uriViewer }
  })

  return { uri: skeleton.uri, versions }
}

function postFromRecord(
  record: Record | undefined,
  ctx: HydrateCtx,
): Post | undefined {
  if (!record) return
  const parsed = parseRecord(
    app.bsky.feed.post.main,
    record,
    !!ctx.includeTakedowns,
  )
  if (!parsed) return
  return {
    ...parsed,
    editedAt: parseDate(record.editedAt),
    violatesThreadGate: false,
    violatesEmbeddingRules: false,
    hasThreadGate: true,
    hasPostGate: true,
    tags: new Set(record.tags),
    debug: { tags: record.tags },
  }
}

function notFound() {
  return new InvalidRequestError('Post not found', 'NotFound')
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = app.bsky.feed.getPostVersions.$Params & { hydrateCtx: HydrateCtx }

type Skeleton = {
  uri: ReturnType<typeof recordUriOf> & string
  versions: Post[]
  counts?: PostAgg[]
}
