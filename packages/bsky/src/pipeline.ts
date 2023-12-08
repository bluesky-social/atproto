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
  skeletonFn: (input: { ctx: Context; params: Params }) => Promise<Skeleton>,
  hydrationFn: (input: {
    ctx: Context
    params: Params
    skeleton: Skeleton
  }) => Promise<HydrationState>,
  rulesFn: (input: {
    ctx: Context
    params: Params
    skeleton: Skeleton
    hydration: HydrationState
  }) => Skeleton,
  presentationFn: (input: {
    ctx: Context
    params: Params
    skeleton: Skeleton
    hydration: HydrationState
  }) => View,
) {
  return async (params: Params, ctx: Context) => {
    const skeleton = await skeletonFn({ ctx, params })
    const hydration = await hydrationFn({ ctx, params, skeleton })
    const appliedRules = rulesFn({ ctx, params, skeleton, hydration })
    return presentationFn({ ctx, params, skeleton: appliedRules, hydration })
  }
}

export function noRulesNew<S>(input: { skeleton: S }) {
  return input.skeleton
}
