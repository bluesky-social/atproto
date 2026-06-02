import { Trans, useLingui } from '@lingui/react/macro'
import { Icon } from '@phosphor-icons/react'
import * as Popover from '@radix-ui/react-popover'
import { clsx } from 'clsx'
import { useState } from 'react'
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
  ...props
}: ButtonCooldownProps) {
  const { t } = useLingui()
  const [isHovered, setIsHovered] = useState(false)

  const handler = useRateLimitedAction({
    action,
    cooldown,
    startWithCooldown,
  })
  const remainingSeconds = Math.ceil(handler.remaining)

  const showRateLimit = !disabled && handler.isRateLimited
  const percent = ((handler.total - handler.remaining) / handler.total) * 100

  return (
    <span
      className="inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Popover.Root open={showRateLimit && isHovered}>
        <Popover.Trigger asChild>
          <Button
            onClick={(event) => {
              onClick?.(event)
              if (!event.defaultPrevented) {
                void handler.trigger()
              }
            }}
            size={size}
            loading={loading || handler.isPending}
            disabled={disabled || handler.isRateLimited}
            className={clsx(
              'relative',
              size === 'sm' ? 'pl-7' : 'pl-9',
              className,
            )}
            aria-label={
              showRateLimit
                ? t`Please wait ${remainingSeconds} seconds before trying again.`
                : undefined
            }
            aria-live={showRateLimit ? 'polite' : undefined}
            aria-atomic="true"
            {...props}
          >
            {!showRateLimit && IdleIcon ? (
              <IdleIcon
                className={clsx(
                  'absolute top-1/2 -translate-y-1/2',
                  size === 'sm' ? 'left-2' : 'left-3',
                )}
                aria-hidden
                weight="bold"
              />
            ) : (
              <CircularProgress
                className={clsx(
                  'absolute top-1/2 -translate-y-1/2',
                  size === 'sm' ? 'left-2' : 'left-3',
                )}
                aria-hidden
                size={16}
                value={percent}
                startAngle={-90}
              />
            )}
            {children}
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content side="bottom" align="center" role="tooltip">
            <span className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs shadow-sm dark:border-slate-600 dark:bg-slate-800">
              <Trans>Retry in {remainingSeconds}s</Trans>
            </span>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </span>
  )
}
