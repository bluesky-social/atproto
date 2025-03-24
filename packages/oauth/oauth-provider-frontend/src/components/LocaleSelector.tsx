import React from 'react'
import { clsx } from 'clsx'
import { ChevronDownIcon } from '@heroicons/react/20/solid'

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
          'pl-2 pr-8 py-1.5 rounded-full bg-contrast-25 text-white text-sm font-bold border border-contrast-100 focus:shadow-sm cursor-pointer',
          'hover:bg-contrast-0 focus:bg-contrast-0 dark:hover:bg-contrast-0',
          'focus:outline-none focus:bg-contrast-0 dark:focus:bg-contrast-0',
        ])}
        onChange={(e) => onSelect(e.target.value)}
      >
        {items.map((item) => (
          <option
            key={item.value}
            value={item.value}
            selected={item.value === value}
          >
            {item.label}
          </option>
        ))}
      </select>

      <ChevronDownIcon className="absolute right-2 top-0 bottom-0 w-5 h-5 my-auto pointer-events-none" />
    </div>
  )
}
