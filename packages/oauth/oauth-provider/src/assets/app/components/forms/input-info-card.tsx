import { memo } from 'react'
import { clsx } from '../../lib/clsx.ts'
import { Override } from '../../lib/util.ts'
import { AlertIcon } from '../utils/icons.tsx'
import { InputLayout, InputLayoutProps } from './input-layout.tsx'

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
          'py-3 overflow-hidden',
          role === 'alert' ? 'text-error-c' : undefined,
        )}
      >
        {children}
      </div>
    </InputLayout>
  )
})
