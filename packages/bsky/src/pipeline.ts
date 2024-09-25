import { AtpAgent } from '@atproto/api'
import { DataPlaneClient } from './data-plane/index.js'
import { FeatureGates } from './feature-gates.js'
import { HydrateCtx, HydrationState, Hydrator } from './hydration/hydrator.js'
import { Views } from './views/index.js'
import { resHeaders } from './api/util.js'

export type RequestContext = {
  hydrateCtx: HydrateCtx
  hydrator: Hydrator
  views: Views
  dataplane: DataPlaneClient
  suggestionsAgent?: AtpAgent
  searchAgent?: AtpAgent
  featureGates: FeatureGates
}

export type PipelineOptions<Skeleton, Params> = DefaultHeadersOptions & {
  extraHeaders?: HeadersFn<Skeleton, Params>
}

export function createPipeline<Skeleton, Params, View>(
  skeletonFn: SkeletonFn<Skeleton, Params>,
  hydrationFn: HydrationFn<Skeleton, Params>,
  rulesFn: RulesFn<Skeleton, Params>,
  presentationFn: PresentationFn<Skeleton, Params, View>,
  options: PipelineOptions<Skeleton, Params> = {},
) {
  const extraHeaders = options.extraHeaders

  return async (
    ctx: RequestContext,
    params: Params,
    headers?: Record<string, string>,
  ): Promise<{
    body: View
    headers?: Record<string, string>
    encoding: 'application/json'
  }> => {
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
        ...(await extraHeaders?.({ ctx, params, skeleton: rules })),
        ...(await defaultHeaders(ctx, options)),
      },
      body: view,
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
}) => Awaitable<Record<string, string>>

export function noRules<S>(input: { skeleton: S }) {
  return input.skeleton
}

export type DefaultHeadersOptions = {
  exposeRepoRev?: boolean
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
