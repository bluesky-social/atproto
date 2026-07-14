import { type Ref, useMemo } from 'react'

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): Ref<T> {
  return (value) => {
    const cleanups = refs.map((r) => {
      if (typeof r === 'function') return r(value)
      if (r) {
        r.current = value
        return () => {
          r.current = null
        }
      }
    })

    return () => {
      for (const cleanup of cleanups) {
        cleanup?.()
      }
    }
  }
}

export function useMergedRefs<T>(...refs: Array<Ref<T> | undefined>): Ref<T> {
  return useMemo(() => mergeRefs(...refs), refs)
}
