import { JSX } from 'react'

export type ButtonProps = {
  transparent?: boolean
  size?: 'small' | 'medium' | 'large'
} & JSX.IntrinsicElements['button']
export function Button({
  transparent = false,
  size = 'medium',
  children,
  className = '',
  ...props
}: ButtonProps) {
  const actionable = props.type === 'submit' || props.onClick != null
  return (
    <button
      {...props}
      tabIndex={props?.tabIndex ?? (actionable ? 0 : -1)}
      className={[
        `inline-block space-x-2 rounded-md`,
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'transition duration-300 ease-in-out',
        size === 'small'
          ? 'px-1 py-0'
          : size === 'large'
            ? 'px-3 py-2'
            : 'px-2 py-1',
        transparent
          ? 'bg-transparent text-purple-600 hover:bg-purple-100 focus:ring-purple-500'
          : 'bg-purple-600 text-white shadow-lg hover:bg-purple-700 focus:ring-purple-800',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}
