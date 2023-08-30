export function createPipeline<
  Params,
  Context,
  SkeletonState,
  HydrationState extends SkeletonState,
  View,
>(
  context: (params: Params) => Context,
  skeleton: (params: Params, ctx: Context) => Promise<SkeletonState>,
  hydration: (state: SkeletonState, ctx: Context) => Promise<HydrationState>,
  rules: (state: HydrationState, ctx: Context) => HydrationState,
  presentation: (state: HydrationState, ctx: Context) => View,
) {
  return async (params: Params) => {
    const ctx = context(params)
    const skeletonState = await skeleton(params, ctx)
    const hydrationState = await hydration(skeletonState, ctx)
    return presentation(rules(hydrationState, ctx), ctx)
  }
}

export function noRules<T>(state: T) {
  return state
}
