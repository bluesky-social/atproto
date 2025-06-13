import { JSX, MouseEventHandler, ReactNode, useRef, useState } from 'react'
import { useClickOutside } from '../lib/use-click-outside.ts'
import { Button, ButtonProps } from './button.tsx'

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
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useClickOutside(rootRef, () => setOpen(false))

  return (
    <div className="relative inline-block" ref={rootRef}>
      <Button
        {...buttonProps}
        className={['relative z-10', className].join(' ')}
        onClick={() => setOpen((prev) => !prev)}
      >
        {children}
      </Button>
      {open && (
        <div
          className="absolute right-0 z-50 mt-2 min-w-36 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
          onClick={(event) => {
            if (!event.defaultPrevented) setOpen(false)
          }}
        >
          {menu.map((item, index) => (
            <>
              {index !== 0 && (
                <hr
                  key={`divider-${index}`}
                  className="my-1 border-t border-gray-200"
                />
              )}
              <Item key={index} item={item} />
            </>
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
          className={[
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
