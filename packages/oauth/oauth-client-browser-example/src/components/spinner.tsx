import { JSX } from 'react'

type SpinnerProps = {
  size?: 'small' | 'medium' | 'large'
} & JSX.IntrinsicElements['div']

export function Spinner({
  size = 'medium',
  className = '',
  ...props
}: SpinnerProps) {
  const sizeClass =
    size === 'small' ? 'h-4 w-4' : size === 'large' ? 'h-6 w-6' : 'h-5 w-5'
  return (
    <div {...props} className={`flex items-center justify-center ${className}`}>
      <div className={`relative inline-block ${sizeClass}`} role="status">
        <div
          className={`animate-spin rounded-full border-2 border-solid border-current border-t-transparent ${sizeClass}`}
        />
      </div>
    </div>
  )
}
