import { useRef } from 'react'

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
 * @note This hook is not a replacement for `useCallback` and should be used
 * with caution, as it can lead to unexpected behavior, especially if the
 * returned function is called during render.
 *
 * @see {@link https://github.com/reactjs/rfcs/blob/useevent/text/0000-useevent.md}
 */
export function useStableCallback<T extends (...args: any[]) => any>(fn: T) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  const ref = useRef(function (this: any, ...args: any[]) {
    return fnRef.current.call(this, ...args)
  })
  return ref.current as T
}
