import React from 'react'
import {
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

type Variant = 'tip' | 'info' | 'warning' | 'error'

const icons: Record<Variant, typeof LightBulbIcon> = {
  tip: LightBulbIcon,
  info: InformationCircleIcon,
  warning: ExclamationTriangleIcon,
  error: ExclamationCircleIcon,
}

const borderColors: Record<Variant, string> = {
  tip: '',
  info: '',
  warning: 'border-warning-500 dark:border-warning-700',
  error: 'border-error-500 dark:border-error-400',
}
const iconColors: Record<Variant, string> = {
  tip: 'text-success-600 dark:text-success-500',
  info: 'text-primary-500',
  warning: 'text-warning-600 dark:text-warning-500',
  error: 'text-error-500 dark:text-error-400',
}

export function Card({
  children,
  variant,
}: {
  children: React.ReactNode
  variant?: Variant
}) {
  const borderColor = variant ? borderColors[variant] : ''
  return (
    <div
      className={clsx([
        'border rounded-md pl-3 py-3 pr-4 space-x-3 flex items-start border-contrast-25 dark:border-contrast-50 shadow-lg shadow-contrast-500/20 dark:shadow-contrast-0/50',
        borderColor,
      ])}
    >
      {children}
    </div>
  )
}

export function Icon({ variant }: { variant?: Variant }) {
  const Icon = variant ? icons[variant] : icons.info
  const color = variant ? iconColors[variant] : iconColors.info
  return (
    <div className={clsx(['pt-0.5', color])}>
      <Icon width={24} />
    </div>
  )
}

export function Content({ children }: { children: React.ReactNode }) {
  return <div className="flex-grow space-y-1">{children}</div>
}

export function Title({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-semibold leading-snug">{children}</h3>
}

export function Text({ children }: { children: React.ReactNode }) {
  return <p className="text-md text-text-light">{children}</p>
}

export function Default({
  variant,
  title,
  text,
}: {
  variant?: Variant
  title?: string
  text: string
}) {
  return (
    <Card variant={variant}>
      <Icon variant={variant} />
      <Content>
        {title && <Title>{title}</Title>}
        <Text>{text}</Text>
      </Content>
    </Card>
  )
}
