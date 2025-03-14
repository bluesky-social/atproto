import { ForwardedRef } from 'react'

export function updateRef<T>(ref: ForwardedRef<T>, value: T | null) {
  if (typeof ref === 'function') {
    ref(value)
  } else if (ref) {
    ref.current = value
  }
}

export function mergeRefs<T>(refs: readonly (ForwardedRef<T> | undefined)[]) {
  return (value: T | null) => {
    for (const ref of refs) {
      if (ref) updateRef(ref, value)
    }
  }
}
