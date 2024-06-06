/**
 * @todo (?) move to common package
 */
export const withSignal = async <T>(
  options:
    | undefined
    | {
        signal?: AbortSignal
        timeout: number
      },
  fn: (signal: AbortSignal) => T | PromiseLike<T>,
): Promise<T> => {
  options?.signal?.throwIfAborted()

  const abortController = new AbortController()
  const { signal } = abortController

  options?.signal?.addEventListener(
    'abort',
    (reason) => abortController.abort(reason),
    { once: true, signal },
  )

  if (options?.timeout != null) {
    const timeoutId = setTimeout(
      (err) => abortController.abort(err),
      options.timeout,
      new Error('Timeout'),
    )

    timeoutId.unref?.() // NodeJS only

    signal.addEventListener('abort', () => clearTimeout(timeoutId), {
      once: true,
      signal,
    })
  }

  try {
    return await fn(signal)
  } finally {
    // - Remove listener on incoming signal
    // - Cancel timeout
    // - Cancel pending (async) tasks
    abortController.abort()
  }
}

export function contentMime(headers: Headers): string | undefined {
  return headers.get('content-type')?.split(';')[0]!.trim()
}
