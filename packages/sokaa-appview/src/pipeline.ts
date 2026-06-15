import { HydrationState } from './hydration/hydrator'

export function createPipeline<Params, Skeleton, View, Context>(
  skeletonFn: (input: SkeletonFnInput<Context, Params>) => Promise<Skeleton>,
  hydrationFn: (
    input: HydrationFnInput<Context, Params, Skeleton>,
  ) => Promise<HydrationState>,
  rulesFn: (input: RulesFnInput<Context, Params, Skeleton>) => Skeleton,
  presentationFn: (
    input: PresentationFnInput<Context, Params, Skeleton>,
  ) => View,
) {
  return async (params: Params, ctx: Context) => {
    const skeleton = await skeletonFn({ ctx, params })
    const hydration = await hydrationFn({ ctx, params, skeleton })
    const appliedRules = rulesFn({ ctx, params, skeleton, hydration })
    return presentationFn({ ctx, params, skeleton: appliedRules, hydration })
  }
}

export type SkeletonFnInput<Context, Params> = {
  ctx: Context
  params: Params
}

export type HydrationFnInput<Context, Params, Skeleton> = {
  ctx: Context
  params: Params
  skeleton: Skeleton
}

export type RulesFnInput<Context, Params, Skeleton> = {
  ctx: Context
  params: Params
  skeleton: Skeleton
  hydration: HydrationState
}

export type PresentationFnInput<Context, Params, Skeleton> = {
  ctx: Context
  params: Params
  skeleton: Skeleton
  hydration: HydrationState
}

export function noRules<S>(input: { skeleton: S }) {
  return input.skeleton
}
