export type ResultSuccess<V = any> = {
  success: true
  value: V
  reason?: undefined
}

/**
 * Represents a failed result containing an error reason.
 *
 * @typeParam E - The type of the error reason
 */
export type ResultFailure<E = Error> = {
  success: false
  reason: E
}
