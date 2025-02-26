import { useCallback, useEffect, useState } from 'react'

export type Step = {
  enabled: boolean
  required: boolean
}

const isEnabled = (s: Step) => s.enabled
const isRequired = (s: Step) => s.required && s.enabled

export function useStepper<const S extends Step>(steps: readonly S[]) {
  const first = steps.findIndex(isEnabled)
  const last = steps.findLastIndex(isEnabled)
  const firstRequired = steps.findIndex(isRequired)

  const [currentIdx, setCurrentIdx] = useState<number>(first)

  const to = useCallback(
    (idx: number) => {
      if (idx !== -1 && steps[idx].enabled) {
        setCurrentIdx(idx)
        return true
      } else {
        return false
      }
    },
    [steps.map(isEnabled).join()],
  )

  const prev = steps.findLastIndex((s, i) => s.enabled && i < currentIdx)
  const next = steps.findIndex((s, i) => s.enabled && i > currentIdx)

  const toFirst = useCallback(() => to(first), [to, first])
  const toLast = useCallback(() => to(last), [to, last])
  const toPrev = useCallback(() => to(prev), [to, prev])
  const toNext = useCallback(() => to(next), [to, next])
  const toRequired = useCallback(() => to(firstRequired), [to, firstRequired])

  // Step number in user friendly terms (accounting for disabled steps)
  const currentPosition =
    1 +
    currentIdx -
    steps.reduce(
      (acc, s, i) => (!s.enabled && i < currentIdx ? acc + 1 : acc),
      0,
    )
  const count = steps.reduce((acc, s) => (s.enabled ? acc + 1 : acc), 0)

  const isCompleted = steps.every((s) => !s.required || !s.enabled)

  const current =
    currentIdx === -1 || !steps[currentIdx].enabled
      ? undefined
      : steps[currentIdx]

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
