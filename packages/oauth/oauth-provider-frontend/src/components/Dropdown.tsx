import React from 'react'
import { clsx } from 'clsx'

export function Dropdown({
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
    <select
      className={clsx([
        'px-2 py-2 rounded-md bg-contrast-500 text-white text-sm font-bold',
        'hover:bg-contrast-600',
        'focus:outline-none focus-visible:ring focus-visible:ring-contrast-500',
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
  )
}
