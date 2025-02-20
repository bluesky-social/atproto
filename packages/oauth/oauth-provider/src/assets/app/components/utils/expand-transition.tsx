import { JSX } from 'react'
import { clsx } from '../../lib/clsx.ts'
import { Override } from '../../lib/util.ts'

export type ExpandTransitionProps = Override<
  JSX.IntrinsicElements['div'],
  {
    delayed?: boolean
    visible: boolean
  }
>

export function ExpandTransition({
  visible,
  delayed = false,

  // div
  className,
  children,
  ...props
}: ExpandTransitionProps) {
  return (
    <div
      {...props}
      className={clsx(
        'transition-all duration-300 overflow-hidden',
        delayed ? 'delay-300' : 'delay-0',
        visible ? 'max-h-80' : 'max-h-0 -z-10 !mt-0',
        className,
      )}
    >
      {children}
    </div>
  )
}
