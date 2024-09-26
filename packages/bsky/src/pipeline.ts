import { noUndefinedVals } from '@atproto/common'
import { IncomingMessage, ServerResponse } from 'http'
import { Creds } from './auth-verifier.js'
import { HydrateCtx } from './hydration/hydrate-ctx.js'
import { HydrationState } from './hydration/hydrator.js'

export type HandlerRequestContext<Params> = {
  params: Params
  req: IncomingMessage
  res: ServerResponse
  auth: Creds
}

export type HandlerOutput<View> = {
  body: View
  headers?: Record<string, string>
  encoding: 'application/json'
}

export type PipelineOptions<Skeleton, Params> = {
  /**
   * Parse incoming headers and expose the result as `header` input to the
   * pipeline functions.
   */
  inputHeaders?: (req: IncomingMessage) => Record<string, undefined | string>

  /**
   * Extra headers to include in the response.
   */
  outputHeaders?: HeadersFn<Skeleton, Params>
}

export function createPipeline<Skeleton, Params, View>(
  skeletonFn: SkeletonFn<Skeleton, Params>,
  hydrationFn: HydrationFn<Skeleton, Params>,
  rulesFn: RulesFn<Skeleton, Params>,
  presentationFn: PresentationFn<Skeleton, Params, View>,
  options: PipelineOptions<Skeleton, Params> = {},
) {
  const { inputHeaders, outputHeaders } = options

  return async (
    ctx: HydrateCtx,
    reqCtx: HandlerRequestContext<Params>,
  ): Promise<HandlerOutput<View>> => {
    const { req, params } = reqCtx
    const headers = inputHeaders && noUndefinedVals(inputHeaders(req))

    const skeleton = await skeletonFn({ ctx, params, headers })
    const hydration = await hydrationFn({ ctx, params, headers, skeleton })
    const rules = await rulesFn({ ctx, params, headers, skeleton, hydration })
    const body = await presentationFn({
      ctx,
      params,
      headers,
      skeleton: rules,
      hydration,
    })

    return {
      encoding: 'application/json',
      headers: outputHeaders
        ? await outputHeaders({ ctx, params, skeleton: rules })
        : undefined,
      body,
    }
  }
}

export type Awaitable<T> = T | PromiseLike<T>

export type SkeletonFn<Skeleton, Params> = (input: {
  ctx: HydrateCtx
  params: Params
  headers?: Record<string, string>
}) => Awaitable<Skeleton>

export type HydrationFn<Skeleton, Params> = (input: {
  ctx: HydrateCtx
  params: Params
  headers?: Record<string, string>
  skeleton: Skeleton
}) => Awaitable<HydrationState>

export type RulesFn<Skeleton, Params> = (input: {
  ctx: HydrateCtx
  params: Params
  headers?: Record<string, string>
  skeleton: Skeleton
  hydration: HydrationState
}) => Skeleton

export type PresentationFn<Skeleton, Params, View> = (input: {
  ctx: HydrateCtx
  params: Params
  headers?: Record<string, string>
  skeleton: Skeleton
  hydration: HydrationState
}) => View

export type HeadersFn<Skeleton, Params> = (input: {
  ctx: HydrateCtx
  params: Params
  skeleton: Skeleton
}) => Awaitable<undefined | Record<string, string>>

export function noRules<S>(input: { skeleton: S }) {
  return input.skeleton
}
