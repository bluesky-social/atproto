// eslint-disable-next-line @typescript-eslint/ban-types
export type Simplify<T> = { [K in keyof T]: T[K] } & {}

export type RequiredKey<T, K extends keyof T = never> = Simplify<
  T & {
    [L in K]-?: unknown extends T[L]
      ? NonNullable<unknown> | null
      : Exclude<T[L], undefined>
  }
>

export function either<T extends string | number | boolean>(
  a?: T,
  b?: T,
): T | undefined {
  if (a != null && b != null && a !== b) {
    throw new TypeError(`Expected "${b}", got "${a}"`)
  }
  return a ?? b ?? undefined
}
