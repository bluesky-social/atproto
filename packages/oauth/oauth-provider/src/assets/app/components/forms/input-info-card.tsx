import { memo } from 'react'
import { clsx } from '../../lib/clsx'
import { Override } from '../../lib/util'
import { AlertIcon } from '../utils/icons'
import { InputLayout, InputLayoutProps } from './input-layout'

export type InputInfoCardProps = Override<
  Omit<InputLayoutProps, 'icon'>,
  {
    role: 'alert' | 'status'
  }
>
export const InputInfoCard = memo(function InputInfoCard({
  role = 'alert',

  // InputLayoutProps
  children,
  className,
  ...props
}: InputInfoCardProps) {
  return (
    <InputLayout
      {...props}
      className={clsx(
        role === 'alert' ? 'bg-error' : 'bg-gray-100 dark:bg-slate-800',
        className,
      )}
      icon={
        <AlertIcon
          className={clsx(
            'fill-current h-4 w-4',
            role === 'alert' ? 'text-error-c' : 'text-brand',
          )}
        />
      }
    >
      <div
        className={clsx(
          'py-2 overflow-hidden',
          role === 'alert' ? 'text-error-c' : undefined,
        )}
      >
        {children}
      </div>
    </InputLayout>
  )
})
