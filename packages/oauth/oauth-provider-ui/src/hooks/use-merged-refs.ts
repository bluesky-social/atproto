import { type Ref, useMemo } from 'react'

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
