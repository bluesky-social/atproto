import { HeadersMap } from '@atproto/xrpc'

import { Creds } from './auth-verifier'
import { HydrateCtx } from './hydration/hydrate-ctx'
import { HydrationState } from './hydration/hydrator'

export type HandlerOutput<Output> = {
  body: Output
  headers?: HeadersMap
  encoding: 'application/json'
}

export function createPipeline<
  Skeleton,
  Params,
  Auth extends Creds,
  Input,
  Output,
>(
  skeletonFn: SkeletonFn<Skeleton, Params, Auth, Input>,
  hydrationFn: HydrationFn<Skeleton, Params, Auth, Input>,
  rulesFn: RulesFn<Skeleton, Params, Auth, Input>,
  presentationFn: PresentationFn<Skeleton, Params, Output>,
) {
  return async (
    hydrateCtx: HydrateCtx<Params, Auth, Input>,
  ): Promise<HandlerOutput<Output>> => {
    const skeleton = await skeletonFn(hydrateCtx)
    const hydration = await hydrationFn(hydrateCtx, skeleton)
    const rules = rulesFn(hydrateCtx, skeleton, hydration)
    const presentation = presentationFn(hydrateCtx, rules, hydration)

    return {
      encoding: 'application/json',
      headers: presentation.headers,
      body: presentation.body,
    }
  }
}

export type Awaitable<T> = T | PromiseLike<T>

export type SkeletonFn<
  Skeleton,
  Params,
  Auth extends Creds = Creds,
  Input = unknown,
> = (hydrateCtx: HydrateCtx<Params, Auth, Input>) => Awaitable<Skeleton>

export type HydrationFn<
  Skeleton,
  Params,
  Auth extends Creds = Creds,
  Input = unknown,
> = (
  hydrateCtx: HydrateCtx<Params, Auth, Input>,
  skeleton: Skeleton,
) => Awaitable<HydrationState>

export type RulesFn<
  Skeleton,
  Params,
  Auth extends Creds = Creds,
  Input = unknown,
> = (
  hydrateCtx: HydrateCtx<Params, Auth, Input>,
  skeleton: Skeleton,
  hydration: HydrationState,
) => Skeleton

export type PresentationFn<Skeleton, Params, Output> = (
  hydrateCtx: HydrateCtx<Params>,
  skeleton: Skeleton,
  hydration: HydrationState,
) => {
  headers?: HeadersMap
  body: Output
}

export function noRules<S>(hydrateCtx: HydrateCtx, skeleton: S) {
  return skeleton
}
