import { useCallback, useRef } from 'react'

/**
 * Returns a stable version of the given function that always calls the latest
 * version of the function.
 *
 * This is useful when you want to use a function in a dependency array of
 * another hook (e.g. `useEffect`, `useMemo`, etc.) but don't want to re-run the
 * effect when the function changes.
 *
 * It can also be used to avoid having to add a function to the dependency array
 * of an effect when the function is defined inline in the component.
 *
 * Note: The returned function will have a stable reference, but it will call
 * the latest version of the original function, so it may have different
 * behavior if the original function changes.
 */
export function useStableCallback<T extends (...args: any[]) => any>(fn: T) {
  const ref = useRef<T>(fn)

  // Update ref.current on every render to ensure it always has the latest
  // version of the function.
  ref.current = fn

  return useCallback<T>(
    function (this: any, ...args: any[]) {
      return ref.current.call(this, ...args)
    } as T,
    [],
  )
}
