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
