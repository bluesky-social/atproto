import {
  type Icon,
  InfoIcon,
  ProhibitIcon,
  WarningIcon,
} from '@phosphor-icons/react'
import { clsx } from 'clsx'
import { AriaRole, JSX, ReactNode } from 'react'
import { Override } from '#/lib/util.ts'
import { Button, ButtonProps } from '../forms/button.tsx'

type Role = AriaRole & ('note' | 'status' | 'alert')

const icons: Record<Role, Icon> = {
  // @ts-expect-error
  __proto__: null,

  note: InfoIcon,
  status: WarningIcon,
  alert: ProhibitIcon,
}

const cardColors: Record<Role, string> = {
  // @ts-expect-error
  __proto__: null,

  note: 'bg-info-100 dark:bg-info-800 border-info-500 dark:border-info-700',
  status:
    'bg-warning-100 dark:bg-warning-800 border-warning-500 dark:border-warning-700',
  alert:
    'bg-error-100 dark:bg-error-800 border-error-500 dark:border-error-400',
}
const iconColors: Record<Role, string> = {
  // @ts-expect-error
  __proto__: null,

  note: 'text-info-500',
  status: 'text-warning-600 dark:text-warning-500',
  alert: 'text-error-500 dark:text-error-400',
}

const buttonColors: Record<Role, ButtonProps['color']> = {
  // @ts-expect-error
  __proto__: null,

  note: 'info',
  status: 'warning',
  alert: 'error',
}

export type CardProps = JSX.IntrinsicElements['div'] & {
  role: Role
}

export function Card({ children, role, className, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'border-contrast-25 dark:border-contrast-50 flex items-start space-x-3 rounded-md border py-3 pl-3 pr-4',
        'shadow-contrast-500/20 dark:shadow-contrast-0/50 shadow-md',
        'text-text-light',
        cardColors[role],
        className,
      )}
      role={role}
      {...props}
    >
      {children}
    </div>
  )
}

export function Icon({ role }: { role: Role }) {
  const Icon = icons[role]
  if (!Icon) return null // Fool proof

  const color = iconColors[role]
  return (
    <div className={clsx('pt-0.5', color)} aria-hidden>
      <Icon width={20} height={20} />
    </div>
  )
}

export function Content({ children }: { children: ReactNode }) {
  return <div className="max-w-full flex-1 space-y-1">{children}</div>
}

export function Title({ children }: { children: ReactNode }) {
  return <h3 className="text-lg font-semibold leading-snug">{children}</h3>
}

export function Text({ children }: { children: ReactNode }) {
  return <p className="text-md">{children}</p>
}

export function Action({ children, ...props }: ButtonProps) {
  return (
    <div className="-my-1 ml-auto flex-shrink-0 self-center">
      <Button size="sm" {...props}>
        {children}
      </Button>
    </div>
  )
}

export type AdmonitionProps = Override<
  CardProps,
  {
    title?: ReactNode
    action?: ButtonProps
  }
>

export function Admonition({
  role = 'note',
  title,
  action,
  children,
  ...props
}: AdmonitionProps) {
  return (
    <Card role={role} {...props}>
      <Icon role={role} />
      <Content>
        {title && <Title>{title}</Title>}
        {children && <Text>{children}</Text>}
      </Content>
      {action && <Action {...action} color={buttonColors[role]} />}
    </Card>
  )
}
