import { JSX, useState } from 'react'
import { Spinner } from './Spinner.tsx'

export type ButtonProps = {
  action?: () => unknown | Promise<unknown>
  loading?: boolean
  size?: 'small' | 'medium' | 'large'
  transparent?: boolean
} & JSX.IntrinsicElements['button']
export function Button({
  action,
  loading = false,
  size = 'medium',
  transparent = false,

  // button
  children,
  onClick,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const actionable =
    props.type === 'submit' || onClick != null || action != null

  const [pendingActions, setPendingActions] = useState(0)

  const doAction = action
    ? async () => {
        setPendingActions((p) => p + 1)
        try {
          await action()
        } catch (error) {
          console.error('Error in button action:', error)
        } finally {
          setPendingActions((p) => p - 1)
        }
      }
    : null

  const isLoading = loading || pendingActions > 0
  const sizeClass =
    size === 'small'
      ? 'px-2 py-[2px] text-sm'
      : size === 'large'
        ? 'px-3 py-2 text-lg'
        : 'px-2 py-1'

  return (
    <button
      {...props}
      onClick={(event) => {
        onClick?.(event)
        if (doAction != null && !event.defaultPrevented) {
          event.preventDefault()
          void doAction()
        }
      }}
      tabIndex={props?.tabIndex ?? (actionable ? 0 : -1)}
      disabled={disabled || isLoading}
      className={[
        'relative overflow-hidden',
        'inline-block rounded-md',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'transition duration-300 ease-in-out',
        transparent
          ? 'bg-transparent text-purple-600 hover:bg-purple-100 focus:ring-purple-500'
          : 'bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-800',
        sizeClass,
        className,
      ].join(' ')}
    >
      {isLoading && (
        <span className="absolute inset-0 z-10 flex items-center justify-center">
          <Spinner size={size} />
        </span>
      )}

      <span className={isLoading ? 'invisible' : 'visible'}>{children}</span>
    </button>
  )
}
