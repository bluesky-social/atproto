export class HydrationMap<T> extends Map<string, T | null> {
  merge(map: HydrationMap<T>): HydrationMap<T> {
    throw new Error('unimplemented')
  }
}
