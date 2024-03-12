import { Dispatch, useCallback } from 'react'

export function useBoundDispatch<A>(dispatch: Dispatch<A>, value: A) {
  return useCallback(() => dispatch(value), [dispatch, value])
}
