import assert from 'node:assert'

export type Simplify<T> = {
  [K in keyof T]: T[K]
} & NonNullable<unknown>

export type WithRequired<T, K extends keyof T> = Simplify<
  Omit<T, K> & Required<Pick<T, K>>
>

export function assertEmpty(
  obj: Record<string, unknown>,
  message = 'Unexpected fields in object',
): asserts obj is Record<string, never> {
  const restKeys = Object.keys(obj)
  assert(restKeys.length === 0, `${message}: "${restKeys.join('", "')}"`)
}
