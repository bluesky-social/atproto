import React from 'react'

interface Props {
  onClick?: () => void
  children: React.ReactNode
  type?: 'primary' | 'secondary' | 'link'
  pad?: string
  filled?: boolean
  disabled?: boolean
}

const base = ''
const styles: Record<string, string> = {
  default: `${base} border border-gray-500 text-gray-600 hover:bg-gray-50`,
  'default-disabled': `${base} border border-gray-500 text-gray-700 cursor-not-allowed`,
  primary: `${base} border border-blue-600 text-blue-600 hover:bg-blue-50`,
  'primary-disabled': `${base} border border-blue-500 text-blue-500 cursor-not-allowed`,
  'primary-filled': `${base} bg-blue-600 text-white hover:bg-blue-500`,
  'primary-filled-disabled': `${base} bg-blue-500 text-white cursor-not-allowed`,
  secondary: `${base} border border-green-600 text-green-700 hover:bg-green-50`,
  'secondary-disabled': `${base} border border-green-500 text-green-600 cursor-not-allowed`,
  'secondary-filled': `${base} bg-green-600 text-white hover:bg-green-500`,
  'secondary-filled-disabled': `${base} bg-green-500 text-white cursor-not-allowed`,
  link: 'text-blue-600 hover:bg-gray-100',
  'link-disabled': 'text-blue-400 cursor-not-allowed',
}

export const Btn: React.FC<Props> = ({
  onClick,
  children,
  type,
  pad,
  filled,
  disabled,
}) => {
  const styleId = [
    type || 'default',
    filled ? 'filled' : undefined,
    disabled ? 'disabled' : undefined,
  ]
    .filter(Boolean)
    .join('-')
  pad = pad || 'px-6 py-2'
  return (
    <button
      className={`rounded-full ${pad} ${styles[styleId] || ''}`}
      onClick={disabled ? undefined : onClick}
    >
      {children}
    </button>
  )
}
