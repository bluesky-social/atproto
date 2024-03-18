import { HtmlHTMLAttributes } from 'react'
import { clsx } from '../lib/clsx'

export type ErrorCardProps = {
  message?: null | string
  role?: 'alert' | 'status'
}

export function ErrorCard({
  message,

  role = 'alert',
  className,
  ...attrs
}: Partial<ErrorCardProps> &
  Omit<HtmlHTMLAttributes<HTMLDivElement>, keyof ErrorCardProps | 'children'>) {
  return (
    <div
      {...attrs}
      className={clsx(
        'flex items-center rounded bg-error py-1 px-2 text-white dark:text-black shadow-md',
        className,
      )}
      role={role}
    >
      <svg
        className="fill-current h-4 w-4"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
      >
        <path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z" />
      </svg>

      <div className="ml-4">
        <p>
          {typeof message === 'string' ? message : 'An unknown error occurred'}
        </p>
      </div>
    </div>
  )
}
