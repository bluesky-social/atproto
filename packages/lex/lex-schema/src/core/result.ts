export type ResultSuccess<V = any> = { success: true; value: V }
export type ResultFailure<E = Error> = { success: false; reason: E }

export type Result<V = any, E = Error> = ResultSuccess<V> | ResultFailure<E>

/*@__NO_SIDE_EFFECTS__*/
export function success<V>(value: V): ResultSuccess<V> {
  return { success: true, value }
}

/*@__NO_SIDE_EFFECTS__*/
export function failure<E>(reason: E): ResultFailure<E> {
  return { success: false, reason }
}

/*@__NO_SIDE_EFFECTS__*/
export function failureReason<T>(result: ResultFailure<T>): T {
  return result.reason
}

/*@__NO_SIDE_EFFECTS__*/
export function successValue<T>(result: ResultSuccess<T>): T {
  return result.value
}

/**
 * Catches any error and wraps it in a {@link ResultFailure<Error>}.
 *
 * @param err - The error to catch.
 * @returns A {@link ResultFailure<Error>} containing the caught error.
 * @example
 *
 * ```ts
 * declare function someFunction(): Promise<string>
 *
 * const result = await someFunction().then(success, catchall)
 * if (result.success) {
 *   console.log(result.value) // string
 * } else {
 *   console.error(result.error instanceof Error) // true
 *   console.error(result.error.message) // string
 * }
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function catchall(err: unknown): ResultFailure<Error> {
  if (err instanceof Error) return failure(err)
  return failure(new Error('Unknown error', { cause: err }))
}

/**
 * Creates a catcher function for the given constructor that wraps caught errors
 * in a {@link ResultFailure}.
 *
 * @example
 *
 * ```ts
 * class FooError extends Error {}
 * class BarError extends Error {}
 *
 * declare function someFunction(): Promise<string>
 *
 * const result = await someFunction()
 *   .then(success)
 *   .catch(createCatcher(FooError))
 *   .catch(createCatcher(BarError))
 *
 * if (result.success) {
 *   console.log(result.value) // string
 * } else {
 *   console.error(result.error) // FooError | BarError
 * }
 */
/*@__NO_SIDE_EFFECTS__*/
export function createCatcher<T>(Ctor: new (...args: any[]) => T) {
  return (err: unknown): ResultFailure<T> => {
    if (err instanceof Ctor) return failure(err)
    throw err
  }
}
