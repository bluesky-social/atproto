import { AtpAgent } from '@atproto/api'
import { noUndefinedVals } from '@atproto/common'
import { IncomingMessage, ServerResponse } from 'http'
import { resHeaders } from './api/util.js'
import { BsyncClient } from './bsync.js'
import { DataPlaneClient } from './data-plane/index.js'
import { FeatureGates } from './feature-gates.js'
import { HydrateCtx, HydrationState, Hydrator } from './hydration/hydrator.js'
import { Views } from './views/index.js'

export type RequestContext = {
  req: IncomingMessage
  res: ServerResponse
  hydrateCtx: HydrateCtx
  hydrator: Hydrator
  views: Views
  dataplane: DataPlaneClient
  suggestionsAgent?: AtpAgent
  searchAgent?: AtpAgent
  featureGates: FeatureGates
  bsyncClient: BsyncClient
}

export type PipelineOptions<Skeleton, Params, View> = DefaultHeadersOptions & {
  /**
   * Extra headers to include in the response.
   */
  extraHeaders?: HeadersFn<Skeleton, Params>

  onPipelineError?: (
    ctx: RequestContext,
    err: unknown,
  ) => Promise<{
    body: View
    headers?: Record<string, string>
    encoding: 'application/json'
  }>
}

export function createPipeline<Skeleton, Params, View>(
  skeletonFn: SkeletonFn<Skeleton, Params>,
  hydrationFn: HydrationFn<Skeleton, Params>,
  rulesFn: RulesFn<Skeleton, Params>,
  presentationFn: PresentationFn<Skeleton, Params, View>,
  options: PipelineOptions<Skeleton, Params, View> = {},
) {
  const { extraHeaders, onPipelineError } = options

  return async (
    ctx: RequestContext,
    params: Params,
    headers?: Record<string, string>,
  ): Promise<{
    body: View
    headers?: Record<string, string>
    encoding: 'application/json'
  }> => {
    try {
      const skeleton = await skeletonFn({ ctx, params, headers })
      const hydration = await hydrationFn({ ctx, params, headers, skeleton })
      const rules = await rulesFn({ ctx, params, headers, skeleton, hydration })
      const view = await presentationFn({
        ctx,
        params,
        headers,
        skeleton: rules,
        hydration,
      })

      return {
        encoding: 'application/json',
        headers: {
          ...(extraHeaders
            ? noUndefinedVals(
                await extraHeaders({ ctx, params, skeleton: rules }),
              )
            : undefined),
          ...(await defaultHeaders(ctx, options)),
        },
        body: view,
      }
    } catch (err) {
      if (onPipelineError) {
        return onPipelineError(ctx, err)
      }

      throw err
    }
  }
}

type Awaitable<T> = T | PromiseLike<T>

export type SkeletonFn<Skeleton, Params> = (input: {
  ctx: RequestContext
  params: Params
  headers?: Record<string, string>
}) => Awaitable<Skeleton>

export type HydrationFn<Skeleton, Params> = (input: {
  ctx: RequestContext
  params: Params
  headers?: Record<string, string>
  skeleton: Skeleton
}) => Awaitable<HydrationState>

export type RulesFn<Skeleton, Params> = (input: {
  ctx: RequestContext
  params: Params
  headers?: Record<string, string>
  skeleton: Skeleton
  hydration: HydrationState
}) => Skeleton

export type PresentationFn<Skeleton, Params, View> = (input: {
  ctx: RequestContext
  params: Params
  headers?: Record<string, string>
  skeleton: Skeleton
  hydration: HydrationState
}) => View

export type HeadersFn<Skeleton, Params> = (input: {
  ctx: RequestContext
  params: Params
  skeleton: Skeleton
}) => Awaitable<Record<string, undefined | string>>

export function noRules<S>(input: { skeleton: S }) {
  return input.skeleton
}

export type DefaultHeadersOptions = {
  /**
   * Expose the current repo revision in the response headers.
   */
  exposeRepoRev?: boolean

  /**
   * Expose the labelers that were used to generate the response.
   */
  exposeLabelers?: boolean
}

export async function defaultHeaders(
  ctx: RequestContext,
  options?: DefaultHeadersOptions,
) {
  return resHeaders({
    repoRev:
      options?.exposeRepoRev === true
        ? await ctx.hydrator.actor.getRepoRevSafe(ctx.hydrateCtx.viewer)
        : undefined,
    labelers:
      options?.exposeLabelers !== false ? ctx.hydrateCtx.labelers : undefined,
  })
}
