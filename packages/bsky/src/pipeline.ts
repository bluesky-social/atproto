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
    const skeleton = await skeletonFn(ctx)
    const hydration = await hydrationFn(ctx, skeleton)
    const rulesSkeleton = await rulesFn(ctx, skeleton, hydration)
    const presentation = await presentationFn(ctx, rulesSkeleton, hydration)

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
> = (ctx: HydrateCtx<Params, Auth, Input>) => Awaitable<Skeleton>

export type HydrationFn<
  Skeleton,
  Params,
  Auth extends Creds = Creds,
  Input = unknown,
> = (
  ctx: HydrateCtx<Params, Auth, Input>,
  skeleton: Skeleton,
) => Awaitable<HydrationState>

export type RulesFn<
  Skeleton,
  Params,
  Auth extends Creds = Creds,
  Input = unknown,
> = (
  ctx: HydrateCtx<Params, Auth, Input>,
  skeleton: Skeleton,
  hydration: HydrationState,
) => Skeleton

export type PresentationFn<Skeleton, Params, Output> = (
  ctx: HydrateCtx<Params>,
  skeleton: Skeleton,
  hydration: HydrationState,
) => {
  headers?: Record<string, string>
  body: Output
}

export function noRules<S>(ctx: HydrateCtx, skeleton: S) {
  return skeleton
}
