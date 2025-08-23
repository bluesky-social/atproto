export interface Matchable<T> {
  matches(options: T): boolean
}
