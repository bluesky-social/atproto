/**
 * This function serves two purposes:
 * - It ensures that the return value is a Promise, even if the function returns
 *   a "thenable" (i.e. a Promise-like object).
 * - It allows to avoid assigning a `this` context to the function, which is
 *   particularly useful when the function is a member of a "private" object.
 */
export async function callAsync<F extends (...args: any[]) => unknown>(
  fn: F,
  ...args: Parameters<F>
): Promise<Awaited<ReturnType<F>>>
export async function callAsync<F extends (...args: any[]) => unknown>(
  fn?: F,
  ...args: Parameters<F>
): Promise<Awaited<ReturnType<F>> | undefined>
export async function callAsync<F extends (...args: any[]) => unknown>(
  fn?: F,
  ...args: Parameters<F>
): Promise<Awaited<ReturnType<F>> | undefined> {
  return (await fn?.(...args)) as Awaited<ReturnType<F>> | undefined
}

export function invokeOnce<T extends (this: any, ...a: any[]) => any>(
  fn: T,
): T {
  let fnNullable: T | null = fn
  return function (...args) {
    if (fnNullable) {
      const fn = fnNullable
      fnNullable = null
      return fn.call(this, ...args)
    }
    throw new Error('Function called multiple times')
  } as T
}

export function includedIn<T>(this: readonly T[], value: T): boolean {
  return this.includes(value)
}
