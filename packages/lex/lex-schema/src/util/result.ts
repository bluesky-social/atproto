export type ResultSuccess<V = any> = { success: true; value: V }
export type ResultFailure<E = Error> = { success: false; error: E }

export type Result<V = any, E = Error> = ResultSuccess<V> | ResultFailure<E>

export function extractFailureError<T>(result: ResultFailure<T>): T {
  return result.error
}
