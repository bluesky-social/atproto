import { ChevronDownIcon } from '@radix-ui/react-icons'
import { clsx } from 'clsx'

export function LocaleSelector({
  items,
  value,
  onSelect,
}: {
  items: {
    label: string
    value: string
  }[]
  value: string
  onSelect: (value: string) => void
}) {
  return (
    <div className="relative">
      <select
        className={clsx([
          'bg-contrast-25 text-text-default border-contrast-100 cursor-pointer rounded-full border py-1.5 pl-2 pr-8 text-sm font-semibold focus:shadow-sm',
          'hover:bg-contrast-0 focus:bg-contrast-0 dark:hover:bg-contrast-0',
          'focus:bg-contrast-0 dark:focus:bg-contrast-0 focus:outline-none',
        ])}
        onChange={(e) => onSelect(e.target.value)}
        value={value}
      >
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>

      <ChevronDownIcon className="pointer-events-none absolute bottom-0 right-2 top-0 my-auto h-5 w-5" />
    </div>
  )
}
