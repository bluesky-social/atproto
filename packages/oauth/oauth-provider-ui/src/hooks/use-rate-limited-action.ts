import { useCallback, useEffect, useMemo, useState } from 'react'

export type Action = (...args: unknown[]) => unknown

export type RateLimitedActionOptions<TAction extends Action = Action> = {
  action: TAction
  cooldown?: number
  cooldownInitial?: number
}

export type RateLimitedHandler<TAction extends Action> = {
  isRateLimited: boolean
  trigger: TAction
  clear: () => void
  remaining: number
  total: number
}

export function useRateLimitedAction<TAction extends Action>({
  action,
  cooldownInitial = 0,
  cooldown = cooldownInitial > 0 ? cooldownInitial : 30,
}: RateLimitedActionOptions<TAction>): RateLimitedHandler<TAction> {
  const [remaining, setRemaining] = useState(cooldownInitial)

  const trigger = useCallback(
    ((...args) => {
      setRemaining(cooldown)
      return action?.(...args)
    }) as TAction,
    [action, cooldown],
  )

  useEffect(() => {
    if (remaining > 0) {
      const timer = setTimeout(() => {
        setRemaining(remaining - 1)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [remaining])

  const clear = useCallback(() => setRemaining(0), [])

  return useMemo<RateLimitedHandler<TAction>>(
    () => ({
      isRateLimited: remaining > 0,
      trigger: (remaining > 0 ? neverTrigger : trigger) as TAction,
      clear,
      remaining,
      total: cooldown,
    }),
    [remaining, trigger, clear, cooldown],
  )
}

function neverTrigger(..._args: unknown[]): never {
  throw new Error('This function should not be called')
}
