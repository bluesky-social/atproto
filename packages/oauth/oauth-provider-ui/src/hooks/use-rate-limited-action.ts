import { useMemo } from 'react'
import { useAsyncAction } from './use-async-action.ts'
import { useCountdown } from './use-countdown.ts'
import { useStableCallback } from './use-stable-callback.ts'

export type RateLimitedActionOptions = {
  action: () => void | PromiseLike<void>
  cooldown?: number
  startWithCooldown?: boolean
}

export type RateLimitedHandler = {
  isRateLimited: boolean
  isPending: boolean
  trigger: () => Promise<void>
  clear: () => void
  remaining: number
  total: number
}

export function useRateLimitedAction({
  action,
  cooldown = 30,
  startWithCooldown = false,
}: RateLimitedActionOptions): RateLimitedHandler {
  const [remaining, setRemaining] = useCountdown(
    startWithCooldown ? cooldown : 0,
  )

  const { loading, run, reset } = useAsyncAction(async () => {
    await action()
    // Only set the cooldown if the action was successful
    setRemaining(cooldown)
  })

  const trigger = useStableCallback(async () => {
    if (loading || remaining > 0) {
      throw new Error('Action is already running or rate limited')
    }
    return run()
  })

  const clear = useStableCallback(() => {
    setRemaining(0)
    reset()
  })

  const isPending = loading
  const isRateLimited = remaining > 0

  return useMemo<RateLimitedHandler>(
    () => ({
      isRateLimited,
      isPending,
      trigger,
      clear,
      remaining,
      total: cooldown,
    }),
    [remaining, isRateLimited, isPending, trigger, clear, cooldown],
  )
}
