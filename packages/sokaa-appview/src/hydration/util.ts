export class HydrationMap<T> extends Map<string, T | null> implements Merges {
  merge(map: HydrationMap<T>): this {
    map.forEach((val, key) => {
      this.set(key, val)
    })
    return this
  }
}

export interface Merges {
  merge<T extends this>(map: T): this
}

export const mergeMaps = <V, M extends HydrationMap<V>>(
  mapA?: M,
  mapB?: M,
): M | undefined => {
  if (!mapA) return mapB
  if (!mapB) return mapA
  return mapA.merge(mapB)
}

export type ItemRef = { uri: string; cid?: string }

export const parseString = (str: string | undefined): string | undefined => {
  return str && str.length > 0 ? str : undefined
}

export type HydrationState = {
  ctx?: HydrateCtx
  actors?: import('./actor').Actors
  posts?: import('./feed').Posts
  postViewers?: import('./feed').PostViewerStates
  profileViewers?: import('./actor').ProfileViewerStates
}

export type HydrateCtx = {
  viewer: string | null
  includeTakedowns?: boolean
}

export const mergeStates = (
  stateA: HydrationState,
  stateB: HydrationState,
): HydrationState => {
  return {
    ctx: stateA.ctx ?? stateB.ctx,
    actors: mergeMaps(stateA.actors, stateB.actors),
    posts: mergeMaps(stateA.posts, stateB.posts),
    postViewers: mergeMaps(stateA.postViewers, stateB.postViewers),
    profileViewers: mergeMaps(stateA.profileViewers, stateB.profileViewers),
  }
}
