import {
  ForwardedRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

export type AsyncActionController = {
  reset: () => void
}

export type UseAsyncActionOptions = {
  ref?: ForwardedRef<AsyncActionController>
  onLoading?: (loading: boolean) => void
  onError?: (error: Error | undefined) => void
}

export function useAsyncAction(
  fn: (signal: AbortSignal) => void | PromiseLike<void>,
  { ref, onLoading, onError }: UseAsyncActionOptions = {},
) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>()

  const doSetError = useCallback(
    (error: Error | undefined) => {
      setError(error)
      onError?.(error)
    },
    [onError],
  )

  const doSetLoading = useCallback(
    (loading: boolean) => {
      setLoading(loading)
      onLoading?.(loading)
    },
    [onLoading],
  )

  const controllerRef = useRef<AbortController>(null)

  const resetRef = useRef<() => void>(null)
  useEffect(() => {
    resetRef.current = () => {
      controllerRef.current?.abort()
      controllerRef.current = null
      doSetError(undefined)
      doSetLoading(false)
    }
    return () => {
      resetRef.current = null
    }
  }, [doSetError, doSetLoading])

  useImperativeHandle(
    ref,
    (): AsyncActionController => ({
      reset: () => resetRef.current?.(),
    }),
    [],
  )

  // Cancel pending action when unmounted
  useEffect(() => {
    return () => {
      controllerRef.current?.abort()
      controllerRef.current = null
    }
  }, [])

  const run = useCallback(async (): Promise<void> => {
    // Cancel previous run
    controllerRef.current?.abort()

    doSetLoading(true)
    doSetError(undefined)

    const controller = new AbortController()
    const { signal } = controller

    controllerRef.current = controller

    try {
      await fn(signal)
    } catch (err) {
      if (controller === controllerRef.current) {
        doSetError(err instanceof Error ? err : new Error(String(err)))
      } else {
        if (!isAbortReason(signal, err)) {
          console.warn('Async action error after abort', err)
        }
      }
    } finally {
      if (controller === controllerRef.current) {
        controllerRef.current = null
        doSetLoading(false)
      }

      controller.abort()
    }
  }, [fn, doSetLoading, doSetError])

  return {
    loading,
    error,
    run,
  }
}

function isAbortReason(signal: AbortSignal, err: unknown): boolean {
  return (
    signal.aborted &&
    (signal.reason === err ||
      signal.reason === err?.['cause'] ||
      (err instanceof DOMException && err.name === 'AbortError'))
  )
}
