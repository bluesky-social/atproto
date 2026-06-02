import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStableCallback } from './use-stable-callback.ts'

export type AsyncActionController = {
  reset: () => void
}

export function useAsyncAction<Args extends unknown[] = []>(
  fn: (signal: AbortSignal, ...args: Args) => void | PromiseLike<void>,
) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>()
  const controllerRef = useRef<AbortController>(null)

  const reset = useCallback<() => void>(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    setError(undefined)
    setLoading(false)
  }, [])

  // Abort pending action on unmount
  useEffect(() => reset, [])

  const run = useStableCallback(async (...args: Args): Promise<void> => {
    // Cancel previous run
    controllerRef.current?.abort()

    setLoading(true)

    const controller = new AbortController()
    const { signal } = controller

    controllerRef.current = controller

    try {
      await fn(signal, ...args)

      // Clear previous error only after successful completion, to avoid
      // clearing the error if the new action fails. This way the error will be
      // visible until a successful action occurs or the user triggers a reset.
      if (controller === controllerRef.current) {
        setError(undefined)
      }
    } catch (err) {
      if (controller === controllerRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)))
      } else {
        if (!isAbortReason(signal, err)) {
          console.warn('Async action error after abort', err)
        }
      }
    } finally {
      if (controller === controllerRef.current) {
        controllerRef.current = null
        setLoading(false)
      }

      controller.abort()
    }
  })

  return useMemo(
    () => ({ run, reset, loading, error }),
    [run, reset, loading, error],
  )
}

function isAbortReason(signal: AbortSignal, err: unknown): boolean {
  return (
    signal.aborted &&
    (signal.reason === err ||
      signal.reason === err?.['cause'] ||
      (err instanceof DOMException && err.name === 'AbortError'))
  )
}
