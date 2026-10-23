import { type Ref, type RefObject, useMemo, useRef } from 'react'

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): Ref<T> {
  return (value) => {
    const cleanups = refs.map((ref) => {
      if (typeof ref === 'function') return ref(value)
      if (ref) {
        ref.current = value
        return () => {
          ref.current = null
        }
      }
    })

    return () => {
      for (const cleanup of cleanups) cleanup?.()
    }
  }
}

export function useMergedRefs<T>(...refs: Array<Ref<T> | undefined>): Ref<T> {
  return useMemo(() => mergeRefs(...refs), refs)
}

export function useCombinedRef<T>(
  ...refs: Array<Ref<T> | undefined>
): [current: RefObject<T | null>, mergedRef: Ref<T>] {
  const localRef = useRef<T>(null)
  const mergedRef = useMergedRefs<T>(localRef, ...refs)
  return [localRef, mergedRef]
}
