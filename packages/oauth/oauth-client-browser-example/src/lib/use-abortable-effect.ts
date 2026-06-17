import { DependencyList, useEffect } from 'react'

export function useAbortableEffect(
  effect: (signal: AbortSignal) => void | (() => void),
  deps: DependencyList = [],
): void {
  useEffect(() => {
    const abortController = new AbortController()
    const cleanup = effect(abortController.signal)
    return () => {
      abortController.abort()
      cleanup?.()
    }
  }, deps)
}
