import { HydrationState } from './hydration/hydrator'

export type Pipeline<Params, View, Context> = (
  ctx: Context,
  params: Params,
  headers?: Record<string, string>,
) => Promise<View>

export function createPipeline<Params, Skeleton, View, Context>(
  skeletonFn: SkeletonFn<Context, Params, Skeleton>,
  hydrationFn: HydrationFn<Context, Params, Skeleton>,
  rulesFn: RulesFn<Context, Params, Skeleton>,
  presentationFn: PresentationFn<Context, Params, Skeleton, View>,
): Pipeline<Params, View, Context> {
  return async (ctx, params, headers = {}) => {
    const skeleton = await skeletonFn({ ctx, params, headers })
    const hydration = await hydrationFn({ ctx, params, headers, skeleton })
    const appliedRules = rulesFn({ ctx, params, headers, skeleton, hydration })
    return presentationFn({
      ctx,
      params,
      headers,
      skeleton: appliedRules,
      hydration,
    })
  }
}

export type SkeletonFn<Context, Params, Skeleton> = (
  input: SkeletonFnInput<Context, Params>,
) => Skeleton | PromiseLike<Skeleton>
export type SkeletonFnInput<Context, Params> = {
  ctx: Context
  params: Params
  headers: Record<string, string>
}

export type HydrationFn<Context, Params, Skeleton> = (
  input: HydrationFnInput<Context, Params, Skeleton>,
) => HydrationState | PromiseLike<HydrationState>
export type HydrationFnInput<Context, Params, Skeleton> = {
  ctx: Context
  params: Params
  headers: Record<string, string>
  skeleton: Skeleton
}

export type RulesFn<Context, Params, Skeleton> = (
  input: RulesFnInput<Context, Params, Skeleton>,
) => Skeleton
export type RulesFnInput<Context, Params, Skeleton> = {
  ctx: Context
  params: Params
  headers: Record<string, string>
  skeleton: Skeleton
  hydration: HydrationState
}

export type PresentationFn<Context, Params, Skeleton, View> = (
  input: PresentationFnInput<Context, Params, Skeleton>,
) => View
export type PresentationFnInput<Context, Params, Skeleton> = {
  ctx: Context
  params: Params
  headers: Record<string, string>
  skeleton: Skeleton
  hydration: HydrationState
}

export function noRules<S>(input: { skeleton: S }) {
  return input.skeleton
}
