import { Trans, useLingui } from '@lingui/react/macro'
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
  RateLimitedActionOptions
>

export function ButtonCooldown({
  children,
  onClick,
  disabled = false,
  className,
  ...props
}: ButtonCooldownProps) {
  const { t } = useLingui()
  const handler = useRateLimitedAction(props)
  const [isHovered, setIsHovered] = useState(false)
  const remainingSeconds = Math.ceil(handler.remaining)
  const isCoolingDown = !disabled && handler.disabled

  return (
    <div
      className="inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Popover.Root open={isCoolingDown && isHovered}>
        <Popover.Trigger asChild>
          <Button
            onClick={(event) => {
              onClick?.(event)
              if (!event.defaultPrevented) {
                void handler.trigger()
              }
            }}
            disabled={isCoolingDown || disabled}
            className={clsx('relative pr-9', className)}
            aria-label={
              isCoolingDown
                ? t`Please wait ${remainingSeconds} seconds before trying again.`
                : undefined
            }
            aria-live={isCoolingDown ? 'polite' : undefined}
            aria-atomic="true"
            {...props}
          >
            <CircularProgress
              size={16}
              value={
                ((handler.total - handler.remaining) / handler.total) * 100
              }
              startAngle={-90}
              className={clsx(
                'absolute right-3 top-1/2 inline-block -translate-y-1/2 transform transition-opacity',
                isCoolingDown ? 'opacity-100' : 'opacity-0',
              )}
              aria-hidden="true"
            />
            {children}
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content side="bottom" align="center" role="tooltip">
            <div className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs shadow-sm dark:border-slate-600 dark:bg-slate-800">
              <Trans>Retry in {remainingSeconds}s</Trans>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
