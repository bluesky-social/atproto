import { clsx } from '../lib/clsx'
import { Override } from '../lib/util'
import { AlertIcon } from './icons/alert-icon'
import { InputLayout, InputLayoutProps } from './input-layout'

export type InfoCardProps = Override<
  InputLayoutProps,
  {
    role: 'alert' | 'status'
  }
>

export function InfoCard({
  children,
  className,
  role = 'alert',
  ...props
}: InfoCardProps) {
  return (
    <InputLayout
      className={clsx(
        role === 'alert' ? 'bg-error' : 'bg-gray-100 dark:bg-slate-800',
        className,
      )}
      icon={
        <AlertIcon
          className={clsx(
            'fill-current h-4 w-4',
            role === 'alert' ? 'text-white' : 'text-brand',
          )}
        />
      }
      {...props}
    >
      <div
        className={clsx(
          'py-2 overflow-hidden',
          role === 'alert' ? 'text-white' : undefined,
        )}
      >
        {children}
      </div>
    </InputLayout>
  )
}
