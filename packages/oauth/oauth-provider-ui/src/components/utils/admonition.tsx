import { clsx } from 'clsx'
import { JSX, ReactNode, memo } from 'react'
import { Override } from '../../lib/util.ts'
import { AlertIcon, CircleInfoIcon } from './icons.tsx'

export type AdmonitionProps = Override<
  JSX.IntrinsicElements['div'],
  {
    prominent?: boolean
    title?: ReactNode
    append?: ReactNode
    type?: 'alert' | 'status'
  }
>

export const Admonition = memo(function Admonition({
  prominent,
  title,
  type = 'status',
  append,

  // div
  children,
  className,
  ...props
}: AdmonitionProps) {
  const Icon = type === 'alert' ? AlertIcon : CircleInfoIcon
  const titleColor = prominent
    ? 'text-inherit'
    : type === 'alert'
      ? 'text-warning'
      : 'text-primary'
  return (
    <div
      {...props}
      role={props.role ?? type}
      className={clsx(
        'max-w-full',
        'flex flex-row',
        'gap-2',
        'p-3',
        'rounded-lg',
        prominent
          ? type === 'alert'
            ? 'bg-warning text-warning-contrast'
            : 'bg-slate-400 text-slate-900'
          : 'border border-slate-300 dark:border-slate-700',
        className,
      )}
    >
      <Icon aria-hidden className={clsx('size-6 fill-current', titleColor)} />

      <div className="flex flex-1 flex-col justify-center space-y-1">
        {title && <h3 className={`text-md ${titleColor}`}>{title}</h3>}
        {children && <div className="text-sm">{children}</div>}
        {append}
      </div>
    </div>
  )
})
