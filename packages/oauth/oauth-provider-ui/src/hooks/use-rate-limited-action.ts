import { useCallback, useEffect, useMemo, useState } from 'react'

export type RateLimitedActionOptions = {
  cooldownSeconds?: number
  initialCooldown?: number
}

export function useRateLimitedAction<
  TAction extends (...args: any[]) => unknown,
>(
  action?: TAction,
  { cooldownSeconds = 60, initialCooldown = 0 }: RateLimitedActionOptions = {},
) {
  const [remaining, setRemaining] = useState(initialCooldown)
  const disabled = remaining > 0

  const trigger = useCallback(
    (...args: Parameters<TAction>): void | ReturnType<TAction> => {
      if (disabled) throw new Error('Action is on cooldown')
      setRemaining(cooldownSeconds)
      return action?.(...args) as void | ReturnType<TAction>
    },
    [action, cooldownSeconds, disabled],
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

  return useMemo(
    () => ({ disabled, trigger, clear, remaining, total: cooldownSeconds }),
    [disabled, trigger, clear, remaining, cooldownSeconds],
  )
}
