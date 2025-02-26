// @TODO: Move some of these to a shared package ?

export type JsonScalar = string | number | boolean | null
export type Json = JsonScalar | Json[] | { [key: string]: undefined | Json }
export type JsonObject = { [key: string]: Json }
export type JsonArray = Json[]

export type ThisParameterOverride<
  C,
  Fn extends (...a: any) => any,
> = Fn extends (...args: infer P) => infer R
  ? ((this: C, ...args: P) => R) & {
      bind(context: C): (...args: P) => R
    }
  : never

export function isIp(hostname: string) {
  // IPv4
  if (hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) return true

  // IPv6
  if (hostname.startsWith('[') && hostname.endsWith(']')) return true

  return false
}

export const ifString = <V>(v: V) => (typeof v === 'string' ? v : undefined)

export class MaxBytesTransformStream extends TransformStream<
  Uint8Array,
  Uint8Array
> {
  constructor(maxBytes: number) {
    // Note: negation accounts for invalid value types (NaN, non numbers)
    if (!(maxBytes >= 0)) {
      throw new TypeError('maxBytes must be a non-negative number')
    }

    let bytesRead = 0

    super({
      transform: (
        chunk: Uint8Array,
        ctrl: TransformStreamDefaultController<Uint8Array>,
      ) => {
        if ((bytesRead += chunk.length) <= maxBytes) {
          ctrl.enqueue(chunk)
        } else {
          ctrl.error(new Error('Response too large'))
        }
      },
    })
  }
}

const LINE_BREAK = /\r?\n/g
export function padLines(input: string, pad: string) {
  if (!input) return input
  return pad + input.replace(LINE_BREAK, `$&${pad}`)
}

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

export function logCancellationError(err: unknown): void {
  console.warn('Failed to cancel response body', err)
}

export async function stringifyMessage(input: Body & { headers: Headers }) {
  try {
    const headers = stringifyHeaders(input.headers)
    const payload = await stringifyBody(input)
    return headers && payload ? `${headers}\n${payload}` : headers || payload
  } finally {
    void cancelBody(input, 'log')
  }
}

function stringifyHeaders(headers: Headers) {
  return Array.from(headers)
    .map(([name, value]) => `${name}: ${value}`)
    .join('\n')
}

async function stringifyBody(body: Body) {
  try {
    const blob = await body.blob()
    if (blob.type?.startsWith('text/')) {
      const text = await blob.text()
      return JSON.stringify(text)
    }

    if (/application\/(?:\w+\+)?json/.test(blob.type)) {
      const text = await blob.text()
      return text.includes('\n') ? JSON.stringify(JSON.parse(text)) : text
    }

    return `[Body size: ${blob.size}, type: ${JSON.stringify(blob.type)} ]`
  } catch {
    return '[Body could not be read]'
  }
}

export const extractUrl = (input: Request | string | URL) =>
  typeof input === 'string'
    ? new URL(input)
    : input instanceof URL
      ? input
      : new URL(input.url)
