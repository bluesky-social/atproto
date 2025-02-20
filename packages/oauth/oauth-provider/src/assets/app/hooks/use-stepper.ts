import { useCallback, useEffect, useState } from 'react'

export type DisabledStep = false | null | undefined
export type Step = {
  invalid: boolean
}

const isEnabled = (s: Step | DisabledStep): boolean => !!s
const isRequired = (s: Step | DisabledStep): boolean => !!s && s.invalid

export function useStepper<const S extends Step>(
  steps: readonly (S | DisabledStep)[],
) {
  const first = steps.findIndex(isEnabled)
  const last = steps.findLastIndex(isEnabled)
  const firstRequired = steps.findIndex(isRequired)

  const [currentIdx, setCurrentIdx] = useState<number>(first)

  const to = useCallback(
    (idx: number) => {
      if (idx !== -1 && steps[idx]) {
        setCurrentIdx(idx)
        return true
      } else {
        return false
      }
    },
    [steps.map(isEnabled).join()],
  )

  const prev = steps.findLastIndex((s, i) => s && i < currentIdx)
  const next = steps.findIndex((s, i) => s && i > currentIdx)

  const toFirst = useCallback(() => to(first), [to, first])
  const toLast = useCallback(() => to(last), [to, last])
  const toPrev = useCallback(() => to(prev), [to, prev])
  const toNext = useCallback(() => to(next), [to, next])
  const toRequired = useCallback(() => to(firstRequired), [to, firstRequired])

  // Step number in user friendly terms (accounting for disabled steps)
  const currentPosition =
    1 +
    currentIdx -
    steps.reduce((acc, s, i) => (!s && i < currentIdx ? acc + 1 : acc), 0)
  const count = steps.reduce((acc, s) => (s ? acc + 1 : acc), 0)

  const isCompleted = steps.every((s) => !s || !s.invalid)

  const current =
    currentIdx === -1 || !steps[currentIdx] ? undefined : steps[currentIdx]

  // Fool-proof (reset current step in case the current step becomes disabled)
  const broken = currentIdx === -1
  useEffect(() => {
    if (broken) toFirst()
  }, [broken])

  return {
    current,
    currentPosition,
    count,
    isCompleted,
    atFirst: currentPosition === 1,
    atLast: currentPosition === count,
    toFirst,
    toLast,
    toPrev,
    toNext,
    toRequired,
  }
}
