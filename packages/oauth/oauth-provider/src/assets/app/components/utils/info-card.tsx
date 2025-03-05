import { memo } from 'react'
import { clsx } from '../../lib/clsx.ts'
import { Override } from '../../lib/util.ts'
import { IconCard, IconCardProps } from './icon-card.tsx'
import { AlertIcon } from './icons.tsx'

export type InfoCardProps = Override<
  Omit<IconCardProps, 'icon'>,
  {
    role: 'alert' | 'status'
  }
>
export const InfoCard = memo(function InfoCard({
  role = 'alert',

  // IconCardProps
  children,
  className,
  ...props
}: InfoCardProps) {
  return (
    <IconCard
      {...props}
      role={role}
      className={clsx(
        role === 'alert' ? 'bg-error' : 'bg-gray-100 dark:bg-slate-800',
        className,
      )}
      icon={
        <AlertIcon
          aria-hidden
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
    </IconCard>
  )
})
