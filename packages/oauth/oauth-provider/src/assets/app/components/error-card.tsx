import { HtmlHTMLAttributes } from 'react'
import { clsx } from '../lib/clsx'

export type ErrorCardProps = {
  role?: 'alert' | 'status'
}

export function ErrorCard({
  children,
  role = 'alert',
  className,
  ...attrs
}: Partial<ErrorCardProps> &
  Omit<HtmlHTMLAttributes<HTMLDivElement>, keyof ErrorCardProps>) {
  return (
    <div
      {...attrs}
      className={clsx(
        'flex items-center',
        'rounded-lg shadow-md',
        role === 'alert'
          ? 'bg-error text-white'
          : 'bg-gray-100 dark:bg-slate-800',
        className,
      )}
      role={role}
    >
      <div className="flex items-center justify-start overflow-hidden">
        <div className="py-1 px-2">
          <svg
            className={clsx(
              'fill-current h-4 w-4',
              role === 'alert' ? 'text-white' : 'text-error',
            )}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
          >
            <path d="M11.14 4.494a.995.995 0 0 1 1.72 0l7.001 12.008a.996.996 0 0 1-.86 1.498H4.999a.996.996 0 0 1-.86-1.498L11.14 4.494Zm3.447-1.007c-1.155-1.983-4.019-1.983-5.174 0L2.41 15.494C1.247 17.491 2.686 20 4.998 20h14.004c2.312 0 3.751-2.509 2.587-4.506L14.587 3.487ZM13 9.019a1 1 0 1 0-2 0v2.994a1 1 0 1 0 2 0V9.02Zm-1 4.731a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z"></path>
          </svg>
        </div>
        <div className="py-2 pr-1 text-sm">{children}</div>
      </div>
    </div>
  )
}
