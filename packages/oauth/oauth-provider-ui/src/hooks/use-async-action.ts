import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isAbortReason } from '#/lib/util.ts'
import { useStableCallback } from './use-stable-callback.ts'

export type UseAsyncActionOptions = {
  /**
   * Fired synchronously whenever the in-flight state flips (`true` on `run`
   * start, `false` on completion or `reset`). Useful for a parent that needs
   * to mirror the loading state outside of the hook's owner — e.g. a dialog
   * that should not be dismissable while a submit is pending.
   */
  onLoadingChange?: (loading: boolean) => void
}

export type AsyncActionHandler<Args extends unknown[] = []> = {
  run: (...args: Args) => Promise<void>
  reset: () => void
  loading: boolean
  error?: Error
}

export function useAsyncAction<Args extends unknown[] = []>(
  fn: (signal: AbortSignal, ...args: Args) => void | PromiseLike<void>,
  options?: UseAsyncActionOptions,
): AsyncActionHandler<Args> {
  const [loading, setLoadingState] = useState(false)
  const [error, setError] = useState<Error | undefined>()
  const controllerRef = useRef<AbortController>(null)

  const setLoading = useStableCallback((value: boolean) => {
    setLoadingState(value)
    options?.onLoadingChange?.(value)
  })

  const reset = useCallback<() => void>(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    setError(undefined)
    setLoading(false)
  }, [setLoading])

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
