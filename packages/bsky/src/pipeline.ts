import { HydrationState } from './hydration/hydrator'

export function createPipeline<
  Params,
  SkeletonState,
  HydrationState extends SkeletonState,
  View,
  Context,
>(
  skeleton: (params: Params, ctx: Context) => Promise<SkeletonState>,
  hydration: (state: SkeletonState, ctx: Context) => Promise<HydrationState>,
  rules: (state: HydrationState, ctx: Context) => HydrationState,
  presentation: (state: HydrationState, ctx: Context) => View,
) {
  return async (params: Params, ctx: Context) => {
    const skeletonState = await skeleton(params, ctx)
    const hydrationState = await hydration(skeletonState, ctx)
    return presentation(rules(hydrationState, ctx), ctx)
  }
}

export function noRules<T>(state: T) {
  return state
}

export function createPipelineNew<Params, Skeleton, View, Context>(
  skeleton: (ctx: Context, params: Params) => Promise<Skeleton>,
  hydration: (
    ctx: Context,
    params: Params,
    skeleton: Skeleton,
  ) => Promise<HydrationState>,
  rules: (
    ctx: Context,
    skeleton: Skeleton,
    hydration: HydrationState,
  ) => Skeleton,
  presentation: (
    ctx: Context,
    skeleton: Skeleton,
    hydration: HydrationState,
  ) => View,
) {
  return async (params: Params, ctx: Context) => {
    const skeletonState = await skeleton(ctx, params)
    const hydrationState = await hydration(ctx, params, skeletonState)
    const appliedRules = rules(ctx, skeletonState, hydrationState)
    return presentation(ctx, appliedRules, hydrationState)
  }
}

export function noRulesNew<C, S>(ctx: C, skeleton: S) {
  return skeleton
}
