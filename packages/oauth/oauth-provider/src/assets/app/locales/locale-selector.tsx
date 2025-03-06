import { useLingui } from '@lingui/react/macro'
import { JSX } from 'react'
import { clsx } from '../lib/clsx.ts'
import { useLocaleContext } from './locale-context.ts'

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
        'accent-brand',
        // Background
        'bg-gray-100 focus:bg-slate-200 has-[:focus]:bg-slate-200',
        'dark:bg-slate-800 dark:focus:bg-slate-700 dark:has-[:focus]:bg-slate-700',
        // Border
        'outline-none',
        'border-solid border-2 border-transparent',
        'focus:border-brand has-[:focus]:border-brand',
        'hover:border-gray-400 hover:focus:border-gray-400',
        'dark:hover:border-gray-500 dark:hover:focus:border-gray-500',
        // Border
        'rounded-lg',
        // Font
        'text-slate-600 dark:text-slate-300',
        // Layout
        'py-1 px-2',
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
          {name}
          {flag ? ` ${flag}` : ''}
        </option>
      ))}
    </select>
  )
}
