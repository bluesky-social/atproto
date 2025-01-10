import { useCallback, useState } from 'react'

export function useAsyncAction<
  const F extends (...params: any[]) => void | PromiseLike<void>,
>(fn: F) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>()

  const run = useCallback(
    async (...params: Parameters<F>): Promise<void> => {
      setLoading(true)
      setError(undefined)

      try {
        await fn(...params)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
      } finally {
        setLoading(false)
      }
    },
    [fn],
  )

  return {
    loading,
    error,
    run,
  }
}
