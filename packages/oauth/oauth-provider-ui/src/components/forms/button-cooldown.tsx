import { clsx } from 'clsx'
import {
  RateLimitedActionOptions,
  useRateLimitedAction,
} from '#/hooks/use-rate-limited-action.ts'
import { CircularProgress } from '../utils/circular-progress.tsx'
import { Button, ButtonProps } from './button.tsx'

export type ButtonCooldownProps = ButtonProps & RateLimitedActionOptions

export function ButtonCooldown({
  children,
  onClick,
  disabled,
  className,
  ...props
}: ButtonCooldownProps) {
  const action = useRateLimitedAction(onClick, props)

  return (
    <Button
      onClick={action.trigger}
      disabled={action.disabled || disabled}
      className={clsx('relative py-3', className)}
      {...props}
    >
      <CircularProgress
        size={16}
        value={((action.total - action.remaining) / action.total) * 100}
        startAngle={-90}
        className={clsx(
          'absolute left-1 top-1/2 inline-block -translate-y-1/2 transform transition-opacity',
          action.disabled ? 'opacity-100' : 'opacity-0',
        )}
      />
      {children}
    </Button>
  )
}
