import { IncomingMessage, ServerResponse } from 'http'
import { IncomingHttpHeaders } from 'node:http'
import { Creds } from './auth-verifier'
import { HydrateCtx } from './hydration/hydrate-ctx'
import { HydrationState } from './hydration/hydrator'

export type HandlerRequestContext<Params, Auth extends Creds = Creds> = {
  auth: Auth
  params: Params
  input: unknown
  req: IncomingMessage
  res: ServerResponse
}

export type HandlerOutput<Output> = {
  body: Output
  headers?: Record<string, string>
  encoding: 'application/json'
}

export function createPipeline<
  Skeleton,
  Params,
  Output,
  Auth extends Creds = Creds,
>(
  skeletonFn: SkeletonFn<Skeleton, Params>,
  hydrationFn: HydrationFn<Skeleton, Params>,
  rulesFn: RulesFn<Skeleton, Params>,
  presentationFn: PresentationFn<Skeleton, Params, Output>,
) {
  return async (
    ctx: HydrateCtx,
    reqCtx: HandlerRequestContext<Params, Auth>,
  ): Promise<HandlerOutput<Output>> => {
    const { params } = reqCtx
    const { headers } = reqCtx.req

    const skeleton = await skeletonFn({ ctx, params, headers })
    const hydration = await hydrationFn({ ctx, params, headers, skeleton })
    const rules = await rulesFn({ ctx, params, headers, skeleton, hydration })
    const presentation = await presentationFn({
      ctx,
      params,
      headers,
      skeleton: rules,
      hydration,
    })

    return {
      encoding: 'application/json',
      headers: presentation.headers,
      body: presentation.body,
    }
  }
}

export type Awaitable<T> = T | PromiseLike<T>

export type SkeletonFn<Skeleton, Params> = (input: {
  ctx: HydrateCtx
  params: Params
  headers: IncomingHttpHeaders
}) => Awaitable<Skeleton>

export type HydrationFn<Skeleton, Params> = (input: {
  ctx: HydrateCtx
  params: Params
  headers: IncomingHttpHeaders
  skeleton: Skeleton
}) => Awaitable<HydrationState>

export type RulesFn<Skeleton, Params> = (input: {
  ctx: HydrateCtx
  params: Params
  headers: IncomingHttpHeaders
  skeleton: Skeleton
  hydration: HydrationState
}) => Skeleton

export type PresentationFn<Skeleton, Params, Output> = (input: {
  ctx: HydrateCtx
  params: Params
  headers: IncomingHttpHeaders
  skeleton: Skeleton
  hydration: HydrationState
}) => {
  headers?: Record<string, string>
  body: Output
}

export function noRules<S>(input: { skeleton: S }) {
  return input.skeleton
}
