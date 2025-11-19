export type ResultSuccess<V = any> = { success: true; value: V }
export type ResultFailure<E = Error> = { success: false; error: E }

export type Result<V = any, E = Error> = ResultSuccess<V> | ResultFailure<E>

export function success<V>(value: V): ResultSuccess<V> {
  return { success: true, value }
}

export function failure<E>(error: E): ResultFailure<E> {
  return { success: false, error }
}

export function failureError<T>(result: ResultFailure<T>): T {
  return result.error
}

export function successValue<T>(result: ResultSuccess<T>): T {
  return result.value
}

export function catcher(err: unknown): ResultFailure<Error> {
  if (err instanceof Error) return failure(err)
  throw err
}
