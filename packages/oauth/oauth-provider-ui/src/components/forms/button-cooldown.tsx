import { useLingui } from '@lingui/react/macro'
import { Icon } from '@phosphor-icons/react'
import { composeEventHandlers } from '@radix-ui/primitive'
import { clsx } from 'clsx'
import {
  RateLimitedActionOptions,
  useRateLimitedAction,
} from '#/hooks/use-rate-limited-action.ts'
import { Override } from '#/lib/util.ts'
import { CircularProgress } from '../utils/circular-progress.tsx'
import { Button, ButtonProps } from './button.tsx'

export type ButtonCooldownProps = Override<
  ButtonProps,
  RateLimitedActionOptions & {
    idleIcon?: Icon
  }
>

export function ButtonCooldown({
  idleIcon: IdleIcon,

  // RateLimitedActionOptions
  action,
  cooldown,
  startWithCooldown,

  // ButtonProps
  children,
  onClick,
  disabled = false,
  loading,
  className,
  size = 'md',
  'aria-label': ariaLabel,
  'aria-live': ariaLive,
  title,
  ...props
}: ButtonCooldownProps) {
  const { t } = useLingui()

  const handler = useRateLimitedAction({
    action,
    cooldown,
    startWithCooldown,
  })
  const remainingSeconds = Math.ceil(handler.remaining)

  const showRateLimit = !disabled && handler.isRateLimited
  const percent = ((handler.total - handler.remaining) / handler.total) * 100

  return (
    <Button
      onClick={composeEventHandlers(onClick, () => {
        void handler.trigger()
      })}
      size={size}
      loading={loading || handler.isPending}
      disabled={disabled || handler.isRateLimited}
      className={clsx(
        'relative',
        size === 'xs' || size === 'sm' ? 'pl-7' : 'pl-9',
        className,
      )}
      title={showRateLimit ? t`Retry in ${remainingSeconds}s` : title}
      aria-label={
        showRateLimit
          ? t`Please wait ${remainingSeconds} seconds before trying again.`
          : ariaLabel
      }
      aria-live={showRateLimit ? 'polite' : ariaLive}
      aria-atomic="true"
      {...props}
    >
      {!showRateLimit && IdleIcon ? (
        <IdleIcon
          className={clsx(
            'absolute top-1/2 -translate-y-1/2',
            size === 'xs' || size === 'sm' ? 'left-2' : 'left-3',
          )}
          aria-hidden
          weight="bold"
        />
      ) : (
        <CircularProgress
          className={clsx(
            'absolute top-1/2 -translate-y-1/2',
            size === 'xs' || size === 'sm' ? 'left-2' : 'left-3',
          )}
          aria-hidden
          size={16}
          value={percent}
          startAngle={-90}
        />
      )}
      {children}
    </Button>
  )
}
