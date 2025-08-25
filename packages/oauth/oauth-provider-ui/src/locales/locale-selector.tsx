import { useLingui } from '@lingui/react/macro'
import { clsx } from 'clsx'
import { JSX } from 'react'
import { useLocaleContext } from './locale-provider.tsx'

export type LocaleSelectorProps = Omit<
  JSX.IntrinsicElements['select'],
  'value' | 'defaultValue'
>

export function LocaleSelector({
  className,
  onChange,
  ...props
}: LocaleSelectorProps) {
  const { locale, locales, setLocale } = useLocaleContext()
  const { t } = useLingui()

  return (
    <select
      {...props}
      className={clsx(
        'accent-primary',
        'cursor-pointer',
        // Background
        'bg-gray-100 dark:bg-gray-800',
        'hover:bg-gray-200 dark:hover:bg-gray-700',
        // Border
        'transition duration-300 ease-in-out',
        'outline-none',
        'focus:ring-primary focus:ring-2 focus:ring-offset-1 focus:ring-offset-white dark:focus:ring-offset-black',
        // Font
        'text-slate-600 dark:text-slate-300',
        // Layout
        'rounded-lg',
        'p-2 pr-1',
        className,
      )}
      value={locale}
      onChange={(e) => {
        onChange?.(e)
        if (!e.defaultPrevented) {
          setLocale(e.target.value as keyof typeof locales)
        }
      }}
      aria-label={t`Interface language selector`}
    >
      {Object.entries(locales).map(([key, { name, flag }]) => (
        <option key={key} value={key}>
          {flag ? `${flag} ${name}` : name}
        </option>
      ))}
    </select>
  )
}
