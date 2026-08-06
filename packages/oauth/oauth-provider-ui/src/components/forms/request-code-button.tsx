import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { SendIcon } from 'lucide-react'
import { type ComponentProps, type Ref, useImperativeHandle } from 'react'
import { Button } from '#/components/ui/button.tsx'
import { CircularProgress } from '#/components/utils/circular-progress.tsx'
import {
  type RateLimitedActionOptions,
  type RateLimitedHandler,
  useRateLimitedAction,
} from '#/hooks/use-rate-limited-action.ts'
import type { Override } from '#/lib/util.ts'
import { cn } from '#/lib/utils.ts'

export type RequestCodeButtonHandler = RateLimitedHandler

export type RequestCodeButtonProps = Override<
  ComponentProps<typeof Button>,
  RateLimitedActionOptions & {
    ref?: Ref<RequestCodeButtonHandler>
    /** Show the countdown ring even when idle. */
    showProgressWhenIdle?: boolean
  }
>

/**
 * Requests a one-time code, rate-limited by `useRateLimitedAction`: it holds a
 * cooldown between attempts and labels itself with the seconds remaining.
 */
export function RequestCodeButton({
  ref,
  showProgressWhenIdle = false,

  // RateLimitedActionOptions
  action,
  cooldown,
  startWithCooldown,

  // Button
  children = <Trans>Send verification code</Trans>,
  onClick,
  disabled = false,
  className,
  variant = 'secondary',
  size = 'sm',
  'aria-label': ariaLabel,
  'aria-live': ariaLive,
  title,
  ...props
}: RequestCodeButtonProps) {
  const { t } = useLingui()

  const handler = useRateLimitedAction({ action, cooldown, startWithCooldown })
  const remainingSeconds = Math.ceil(handler.remaining)

  const showRateLimit = !disabled && handler.isRateLimited
  const percent = ((handler.total - handler.remaining) / handler.total) * 100

  useImperativeHandle(ref, () => handler, [handler])

  return (
    <Button
      {...props}
      type="button"
      variant={variant}
      size={size}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) void handler.trigger()
      }}
      disabled={disabled || handler.isRateLimited || handler.isPending}
      className={cn('relative', className)}
      title={showRateLimit ? t`Retry in ${remainingSeconds}s` : title}
      aria-label={
        showRateLimit
          ? t`Please wait ${plural(remainingSeconds, {
              one: '# second',
              other: '# seconds',
            })} before trying again.`
          : ariaLabel
      }
      aria-live={showRateLimit ? 'polite' : ariaLive}
      aria-atomic="true"
    >
      {showProgressWhenIdle && (
        <CircularProgress
          aria-hidden
          size={16}
          value={percent}
          startAngle={-90}
        />
      )}
      {!showProgressWhenIdle && !showRateLimit && <SendIcon aria-hidden />}

      <span data-slot="request-code-label" className="truncate">
        {children}
      </span>

      {/* @NOTE Text rather than a progress ring: at the start of a cooldown the
        ring is nearly empty and reads as a broken spinner. These children live
        inside the component, not the caller's <Trans>, so they do not shift the
        message's placeholder indices. */}
      {showRateLimit && !showProgressWhenIdle && (
        <span className="tabular-nums">{t`Retry in ${remainingSeconds}s`}</span>
      )}
    </Button>
  )
}
