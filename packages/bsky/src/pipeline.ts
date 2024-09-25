import { AtpAgent } from '@atproto/api'
import { noUndefinedVals } from '@atproto/common'
import { BsyncClient } from './bsync.js'
import { DataPlaneClient } from './data-plane/index.js'
import { FeatureGates } from './feature-gates.js'
import { HydrateCtx, HydrationState, Hydrator } from './hydration/hydrator.js'
import { Views } from './views/index.js'

export type HandlerContext = {
  hydrateCtx: HydrateCtx
  hydrator: Hydrator
  views: Views
  dataplane: DataPlaneClient
  suggestionsAgent?: AtpAgent
  searchAgent?: AtpAgent
  featureGates: FeatureGates
  bsyncClient: BsyncClient
}

export type PipelineOptions<Skeleton, Params> = {
  /**
   * Extra headers to include in the response.
   */
  extraHeaders?: HeadersFn<Skeleton, Params>
}

export function createPipeline<Skeleton, Params, View>(
  skeletonFn: SkeletonFn<Skeleton, Params>,
  hydrationFn: HydrationFn<Skeleton, Params>,
  rulesFn: RulesFn<Skeleton, Params>,
  presentationFn: PresentationFn<Skeleton, Params, View>,
  options: PipelineOptions<Skeleton, Params> = {},
) {
  const { extraHeaders } = options

  return async (
    ctx: HandlerContext,
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
        ...(extraHeaders
          ? noUndefinedVals(
              await extraHeaders({ ctx, params, skeleton: rules }),
            )
          : undefined),
      },
      body: view,
    }
  }
}

export type Awaitable<T> = T | PromiseLike<T>

export type SkeletonFn<Skeleton, Params> = (input: {
  ctx: HandlerContext
  params: Params
  headers?: Record<string, string>
}) => Awaitable<Skeleton>

export type HydrationFn<Skeleton, Params> = (input: {
  ctx: HandlerContext
  params: Params
  headers?: Record<string, string>
  skeleton: Skeleton
}) => Awaitable<HydrationState>

export type RulesFn<Skeleton, Params> = (input: {
  ctx: HandlerContext
  params: Params
  headers?: Record<string, string>
  skeleton: Skeleton
  hydration: HydrationState
}) => Skeleton

export type PresentationFn<Skeleton, Params, View> = (input: {
  ctx: HandlerContext
  params: Params
  headers?: Record<string, string>
  skeleton: Skeleton
  hydration: HydrationState
}) => View

export type HeadersFn<Skeleton, Params> = (input: {
  ctx: HandlerContext
  params: Params
  skeleton: Skeleton
}) => Awaitable<Record<string, undefined | string>>

export function noRules<S>(input: { skeleton: S }) {
  return input.skeleton
}
