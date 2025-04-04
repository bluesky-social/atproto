import {
  CircleBackslashIcon,
  ExclamationTriangleIcon,
  InfoCircledIcon,
  QuestionMarkCircledIcon,
} from '@radix-ui/react-icons'
import { clsx } from 'clsx'
import { ReactNode } from 'react'

type Variant = 'tip' | 'info' | 'warning' | 'error'

const icons: Record<Variant, typeof QuestionMarkCircledIcon> = {
  tip: QuestionMarkCircledIcon,
  info: InfoCircledIcon,
  warning: ExclamationTriangleIcon,
  error: CircleBackslashIcon,
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
  children: ReactNode
  variant?: Variant
}) {
  const borderColor = variant ? borderColors[variant] : ''
  return (
    <div
      className={clsx([
        'border-contrast-25 dark:border-contrast-50 shadow-contrast-500/20 dark:shadow-contrast-0/50 flex items-start space-x-3 rounded-md border py-3 pl-3 pr-4 shadow-lg',
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
      <Icon width={20} height={20} />
    </div>
  )
}

export function Content({ children }: { children: ReactNode }) {
  return <div className="flex-grow space-y-1">{children}</div>
}

export function Title({ children }: { children: ReactNode }) {
  return <h3 className="text-lg font-semibold leading-snug">{children}</h3>
}

export function Text({ children }: { children: ReactNode }) {
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
