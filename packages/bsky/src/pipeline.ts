import { IncomingHttpHeaders } from 'node:http'
import { Creds } from './auth-verifier'
import { HydrateCtx } from './hydration/hydrate-ctx'
import { HydrationState } from './hydration/hydrator'

export type HandlerOutput<Output> = {
  body: Output
  headers?: Record<string, string>
  encoding: 'application/json'
}

export function createPipeline<
  Skeleton,
  Params,
  Auth extends Creds,
  Input,
  Output,
>(
  skeletonFn: SkeletonFn<Skeleton, Params, Auth>,
  hydrationFn: HydrationFn<Skeleton, Params>,
  rulesFn: RulesFn<Skeleton, Params>,
  presentationFn: PresentationFn<Skeleton, Params, Output>,
) {
  return async (
    ctx: HydrateCtx<Params, Auth, Input>,
  ): Promise<HandlerOutput<Output>> => {
    const { params, headers } = ctx

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

export type SkeletonFn<Skeleton, Params, Auth extends Creds = Creds> = (input: {
  ctx: HydrateCtx<Params, Auth>
  params: Params
  headers: IncomingHttpHeaders
}) => Awaitable<Skeleton>

export type HydrationFn<
  Skeleton,
  Params,
  Auth extends Creds = Creds,
> = (input: {
  ctx: HydrateCtx<Params, Auth>
  params: Params
  headers: IncomingHttpHeaders
  skeleton: Skeleton
}) => Awaitable<HydrationState>

export type RulesFn<Skeleton, Params, Auth extends Creds = Creds> = (input: {
  ctx: HydrateCtx<Params, Auth>
  params: Params
  headers: IncomingHttpHeaders
  skeleton: Skeleton
  hydration: HydrationState
}) => Skeleton

export type PresentationFn<Skeleton, Params, Output> = (input: {
  ctx: HydrateCtx<Params>
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
