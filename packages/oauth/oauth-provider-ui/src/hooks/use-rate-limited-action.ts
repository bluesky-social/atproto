import { useCallback, useEffect, useMemo, useState } from 'react'

export type Action = (...args: unknown[]) => unknown

export type RateLimitedActionOptions<TAction extends Action = Action> = {
  action: TAction
  cooldownSeconds?: number
  initialCooldown?: number
}

export type RateLimitedHandler<TAction extends Action> = {
  disabled: boolean
  trigger: (...args: Parameters<TAction>) => void | ReturnType<TAction>
  clear: () => void
  remaining: number
  total: number
}

export function useRateLimitedAction<TAction extends Action>({
  action,
  cooldownSeconds = 30,
  initialCooldown = 0,
}: RateLimitedActionOptions<TAction>): RateLimitedHandler<TAction> {
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

  return useMemo<RateLimitedHandler<TAction>>(
    () => ({ disabled, trigger, clear, remaining, total: cooldownSeconds }),
    [disabled, trigger, clear, remaining, cooldownSeconds],
  )
}
