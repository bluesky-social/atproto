export async function timed<F extends (signal: AbortSignal) => unknown>(
  ms: number,
  fn: F,
): Promise<Awaited<ReturnType<F>>> {
  const abortController = new AbortController()
  const timer = setTimeout(() => abortController.abort(), ms)
  const signal = abortController.signal

  try {
    return (await fn(signal)) as Awaited<ReturnType<F>>
  } finally {
    clearTimeout(timer)
    abortController.abort()
  }
}
