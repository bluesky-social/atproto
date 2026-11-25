import { logCancellationError } from './util.js'

/**
 * @param [onCancellationError] - Callback that will trigger to asynchronously
 * handle any error that occurs while cancelling the response body. Providing
 * this will speed up the process and avoid potential deadlocks. Defaults to
 * awaiting the cancellation operation. use `"log"` to log the error.
 * @see {@link https://undici.nodejs.org/#/?id=garbage-collection}
 * @note awaiting this function's result, when no `onCancellationError` is
 * provided, might result in a dead lock. Indeed, if the response was cloned(),
 * the response.body.cancel() method will not resolve until the other response's
 * body is consumed/cancelled.
 *
 * @example
 * ```ts
 * // Make sure response was not cloned, or that every cloned response was
 * // consumed/cancelled before awaiting this function's result.
 * await cancelBody(response)
 * ```
 * @example
 * ```ts
 * await cancelBody(response, (err) => {
 *   // No biggie, let's just log the error
 *   console.warn('Failed to cancel response body', err)
 * })
 * ```
 * @example
 * ```ts
 * // Will generate an "unhandledRejection" if an error occurs while cancelling
 * // the response body. This will likely crash the process.
 * await cancelBody(response, (err) => { throw err })
 * ```
 */
export async function cancelBody(
  body: Body,
  onCancellationError?: 'log' | ((err: unknown) => void),
): Promise<void> {
  if (
    body.body &&
    !body.bodyUsed &&
    !body.body.locked &&
    // Support for alternative fetch implementations
    typeof body.body.cancel === 'function'
  ) {
    if (typeof onCancellationError === 'function') {
      void body.body.cancel().catch(onCancellationError)
    } else if (onCancellationError === 'log') {
      void body.body.cancel().catch(logCancellationError)
    } else {
      await body.body.cancel()
    }
  }
}
