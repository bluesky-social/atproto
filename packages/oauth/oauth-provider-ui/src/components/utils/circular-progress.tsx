import { clsx } from 'clsx'
import { JSX } from 'react'
import { Override } from '#/lib/util.ts'

export type CircularProgressProps = Override<
  JSX.IntrinsicElements['svg'],
  {
    /**
     * Progress value from 0 to 100
     */
    value?: number
    /**
     * Size of the circular progress in pixels (both width and height)
     * @default 24
     */
    size?: number
    /**
     * Width of the progress stroke in pixels
     * @default 2
     */
    strokeWidth?: number
    /**
     * Children are not supported for CircularProgress since it's meant to be a simple visual indicator. Any children passed will be ignored.
     */
    children?: never
    /**
     * Initial angle in degrees (0 = 3 o'clock, 90 = 6 o'clock, etc.)
     * @default 0
     */
    startAngle?: number
    /**
     * Direction of progress
     * @default 'clockwise'
     */
    progressDirection?: 'clockwise' | 'counter-clockwise'
  }
>

export function CircularProgress({
  value,
  startAngle = 0,
  progressDirection = 'clockwise',
  size = 24,
  strokeWidth = 2,

  // svg
  className,
  ...props
}: CircularProgressProps) {
  const center = size / 2
  const radius = center - strokeWidth / 2
  const circumference = 2 * Math.PI * radius

  // Clamp value between 0 and 100
  const clampedValue = Math.max(0, Math.min(100, value ?? 70))

  // Calculate progress (0-100 to 0-1)
  const progress = clampedValue / 100

  // For clockwise, we need to show progress from startAngle
  // For counter-clockwise, we invert the direction
  const strokeDashoffset =
    progressDirection === 'clockwise'
      ? circumference * (1 - progress)
      : circumference * progress

  return (
    <svg
      width={size}
      height={size}
      style={{ transform: `rotate(${startAngle}deg)` }}
      className={clsx(value == null && 'animate-spin', className)}
      {...props}
    >
      {/* Background circle */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="opacity-20"
      />
      {/* Progress circle */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        className="transition-all duration-100 ease-linear"
        style={{
          transform:
            progressDirection === 'counter-clockwise'
              ? 'scaleX(-1)'
              : undefined,
          transformOrigin: 'center',
        }}
      />
    </svg>
  )
}
