export function upsert<T>(
  arr: undefined | readonly T[],
  item: T,
  predicate: (value: T, index: number, obj: readonly T[]) => boolean,
): T[] {
  if (!arr) return [item]
  const idx = arr.findIndex(predicate)
  return idx === -1
    ? [...arr, item]
    : [...arr.slice(0, idx), item, ...arr.slice(idx + 1)]
}

export type Explicit<T> = { [K in keyof T & string]: T[K] }
export type Simplify<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>
export type Override<T, U> = Simplify<Omit<T, keyof U> & U>

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function toJsonSafe(value: unknown): string | undefined {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return undefined
  }
}

export function isAbortReason(signal: AbortSignal, error: unknown): boolean {
  return (
    signal.aborted &&
    signal.reason != null &&
    error instanceof Error &&
    (error === signal.reason || error.cause === signal.reason)
  )
}
