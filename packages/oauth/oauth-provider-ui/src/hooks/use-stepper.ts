import { useCallback, useEffect, useState } from 'react'

export type DisabledStep = false | null | undefined
export type Step = {
  invalid: boolean
}

const isEnabled = <S extends Step | DisabledStep>(
  s: S,
): s is S extends DisabledStep ? never : S => s != null && s !== false
const isRequired = <S extends Step | DisabledStep>(
  s: S,
): s is S extends DisabledStep ? never : S & { invalid: true } =>
  isEnabled(s) && s.invalid === true
const isCompleted = <S extends Step | DisabledStep>(
  s: S,
): s is S extends DisabledStep ? S : S & { invalid: false } =>
  !isEnabled(s) || s.invalid === false

export function useStepper<const S extends Step>(
  steps: readonly (S | DisabledStep)[],
) {
  const firstIdx = steps.findIndex(isEnabled)
  const lastIdx = steps.findLastIndex(isEnabled)
  const requiredIdx = steps.findIndex(isRequired)

  const [currentIdx, setCurrentIdx] = useState<number>(firstIdx)

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

  const prevIdx = steps.findLastIndex((s, i) => isEnabled(s) && i < currentIdx)
  const nextIdx = steps.findIndex((s, i) => isEnabled(s) && i > currentIdx)

  const toFirst = useCallback(() => to(firstIdx), [to, firstIdx])
  const toLast = useCallback(() => to(lastIdx), [to, lastIdx])
  const toPrev = useCallback(() => to(prevIdx), [to, prevIdx])
  const toNext = useCallback(() => to(nextIdx), [to, nextIdx])
  const toRequired = useCallback(() => to(requiredIdx), [to, requiredIdx])

  // Step number in user friendly terms (accounting for disabled steps)
  const currentPosition =
    currentIdx +
    // use "1 indexed position" (for user friendliness):
    1 +
    // Adjust the position by counting the number of disabled steps before the
    // current step (if any):
    steps.reduce(
      (acc, s, i) => (i >= currentIdx || isEnabled(s) ? acc : acc - 1),
      0,
    )

  const count = steps.filter(isEnabled).length
  const completed = steps.every(isCompleted)

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
    completed,
    atFirst: currentPosition === 1,
    atLast: currentPosition === count,
    toFirst,
    toLast,
    toPrev,
    toNext,
    toRequired,
  }
}
