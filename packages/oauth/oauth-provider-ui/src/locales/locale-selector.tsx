import { useLingui } from '@lingui/react/macro'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select.tsx'
import { cn } from '#/lib/utils.ts'
import { useLocaleContext } from './locale-provider.tsx'

export type LocaleSelectorProps = {
  className?: string
}

export function LocaleSelector({ className }: LocaleSelectorProps) {
  const { locale, locales, setLocale } = useLocaleContext()
  const { t } = useLingui()

  return (
    <Select
      value={locale}
      onValueChange={(value) => setLocale(value as keyof typeof locales)}
    >
      <SelectTrigger
        size="sm"
        className={cn('rounded-full', className)}
        aria-label={t`Interface language selector`}
      >
        {/* @NOTE Base UI's `Select.Value` renders the raw `value` unless given
          a function to map it to a label — Radix's echoed the selected item's
          own content. Without this the trigger showed the locale key ("en")
          rather than the language it stands for. */}
        <SelectValue>
          {(value) => {
            const entry = locales[value as keyof typeof locales]
            if (!entry) return value
            return entry.flag ? `${entry.flag} ${entry.name}` : entry.name
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(locales).map(([key, { name, flag }]) => (
          <SelectItem key={key} value={key}>
            {flag ? `${flag} ${name}` : name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
