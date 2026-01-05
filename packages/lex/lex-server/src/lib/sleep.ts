export async function abortableSleep(
  ms: number,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted()

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      signal.removeEventListener('abort', onAbort)
      clearTimeout(timeoutHandle)
    }

    const timeoutHandle = setTimeout(() => {
      cleanup()
      resolve()
    }, ms)

    const onAbort = () => {
      cleanup()
      reject(signal.reason)
    }

    signal.addEventListener('abort', onAbort)
  })
}
