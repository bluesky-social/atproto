import {
  JSX,
  MouseEventHandler,
  ReactNode,
  useCallback,
  useRef,
  useState,
} from 'react'
import { useClickOutside } from '../lib/use-click-outside.ts'
import { useEscapeKey } from '../lib/use-escape-key.ts'
import { useRandomString } from '../lib/use-random-string.ts'
import { Button, ButtonProps } from './Button.tsx'

export type Item = {
  label?: ReactNode
  onClick?: MouseEventHandler<HTMLButtonElement>
  items?: readonly Item[]
}

export type DropdownProps = ButtonProps & {
  menu: readonly Item[]
}
export function ButtonDropdown({
  menu,
  children,
  className = '',
  ...buttonProps
}: DropdownProps) {
  const buttonId = useRandomString({ prefix: 'dropdown-button-' })
  const dropdownId = useRandomString({ prefix: 'dropdown-menu-' })
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  useEscapeKey(close)
  useClickOutside(rootRef, close)

  const id = buttonProps.id || buttonId

  return (
    <div ref={rootRef} className="relative inline-block">
      <Button
        {...buttonProps}
        id={id}
        key="button"
        className={['relative z-10', className].join(' ')}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={dropdownId}
      >
        {children}
      </Button>

      {open && (
        <div
          key="menu"
          id={dropdownId}
          className="absolute right-0 z-50 mt-2 min-w-36 origin-top-right overflow-hidden rounded-md bg-white py-1 shadow-lg ring-1 ring-gray-300 focus:outline-none"
          onClick={(event) => {
            if (!event.defaultPrevented) setOpen(false)
          }}
          role="menu"
          aria-labelledby={id}
        >
          {menu.map((item, index) => (
            <Item
              key={`item-${index}`}
              item={item}
              className={
                index > 0 ? 'mt-1 border-t border-gray-200 pt-1' : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

export type ItemProps = {
  item: Item
} & JSX.IntrinsicElements['div']

function Item({ item: { label, onClick, items }, ...props }: ItemProps) {
  return (
    <div {...props}>
      {label && (
        <button
          key="label"
          type="button"
          role="menuitem"
          className={[
            'flex items-center gap-2',
            'block w-full px-4 py-2 text-left text-sm text-gray-700 focus:outline-none',
            onClick ? 'hover:bg-gray-100 focus:bg-gray-100' : 'cursor-default',
          ].join(' ')}
          onClick={onClick}
        >
          {label}
        </button>
      )}

      {items?.map((item, index) => <Item key={index} item={item} />)}
    </div>
  )
}
