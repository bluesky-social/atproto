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
        // Background
        'bg-contrast-25',
        'hover:bg-contrast-0 focus:bg-contrast-0 dark:hover:bg-contrast-0',
        'focus:bg-contrast-0 dark:focus:bg-contrast-0',
        // Border
        'outline-hidden',
        'border-contrast-100 border',
        // Border
        'rounded-full',
        // Font
        'text-slate-600 dark:text-slate-300',
        // Layout
        'px-2 py-1',
        // Misc
        'cursor-pointer',
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
