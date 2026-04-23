import {
  CheckCircleIcon,
  type Icon,
  InfoIcon,
  ProhibitIcon,
  WarningIcon,
} from '@phosphor-icons/react'
import { clsx } from 'clsx'
import {
  AriaRole,
  JSX,
  ReactNode,
  createContext,
  useContext,
  useMemo,
} from 'react'
import { Override } from '#/lib/util.ts'
import { Button, ButtonProps } from '../forms/button.tsx'

const VARIANTS = ['info', 'warning', 'error', 'success'] as const
type Variant = (typeof VARIANTS)[number]

const ROLE_VARIANT_MAP: ReadonlyMap<AriaRole, Variant> = new Map([
  ['note', 'info'],
  ['status', 'warning'],
  ['alert', 'error'],
])

const roleToVariant = (role?: AriaRole): Variant => {
  return (ROLE_VARIANT_MAP as ReadonlyMap<unknown, Variant>).get(role) ?? 'info'
}

const icons: Record<Variant, Icon> = {
  // @ts-expect-error
  __proto__: null,

  info: InfoIcon,
  success: CheckCircleIcon,
  warning: WarningIcon,
  error: ProhibitIcon,
}

const cardColors: Record<Variant, string> = {
  // @ts-expect-error
  __proto__: null,

  info: 'bg-info-100 dark:bg-info-800 border-info-500 dark:border-info-700',
  warning:
    'bg-warning-100 dark:bg-warning-800 border-warning-500 dark:border-warning-700',
  error:
    'bg-error-100 dark:bg-error-800 border-error-500 dark:border-error-400',
  success:
    'bg-success-100 dark:bg-success-800 border-success-500 dark:border-success-700',
}

const iconColors: Record<Variant, string> = {
  // @ts-expect-error
  __proto__: null,

  info: 'text-info-500',
  warning: 'text-warning-600 dark:text-warning-500',
  error: 'text-error-500 dark:text-error-400',
  success: 'text-success-500 dark:text-success-400',
}

const buttonColors: Record<Variant, ButtonProps['color']> = {
  // @ts-expect-error
  __proto__: null,

  info: 'info',
  warning: 'warning',
  error: 'error',
  success: 'success',
}

export type CardProps = Override<
  JSX.IntrinsicElements['div'],
  {
    role: AriaRole
    variant?: Variant
  }
>

export type AdmonitionContextValue = {
  variant: Variant
}
export const AdmonitionContext = createContext<AdmonitionContextValue>({
  variant: 'info',
})
AdmonitionContext.displayName = 'AdmonitionContext'

export function Card({
  role,
  className,
  variant = roleToVariant(role),
  children,
  ...props
}: CardProps) {
  const value = useMemo(() => ({ variant }), [variant])
  return (
    <div
      className={clsx(
        'flex items-start space-x-2',
        'rounded-md py-3 pl-3 pr-4',
        'border-contrast-25 dark:border-contrast-50 border',
        'shadow-contrast-500/20 dark:shadow-contrast-0/50 shadow-md',
        'text-gray-900 dark:text-gray-100',
        cardColors[variant],
        className,
      )}
      role={role}
      {...props}
    >
      <AdmonitionContext.Provider value={value}>
        {children}
      </AdmonitionContext.Provider>
    </div>
  )
}

export function Icon({
  variant: variantProp,
  children,
}: {
  variant?: Variant
  children?: ReactNode
}) {
  const ctx = useContext(AdmonitionContext)
  const variant: Variant = variantProp ?? ctx.variant

  const Icon = icons[variant]

  return (
    <div className={clsx('pt-0.5', iconColors[variant])} aria-hidden>
      {children || <Icon width={20} height={20} />}
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

export function Actions({ children }: { children: ReactNode }) {
  return <div className="-my-1 ml-auto flex-shrink-0">{children}</div>
}

export function Action({
  children,
  size = 'sm',
  color,
  ...props
}: ButtonProps) {
  const { variant } = useContext(AdmonitionContext)

  return (
    <Button size={size} color={color ?? buttonColors[variant]} {...props}>
      {children}
    </Button>
  )
}

export type AdmonitionProps = Override<
  CardProps,
  {
    title?: ReactNode
    action?: ReactNode
    append?: ReactNode
  }
>

export function Admonition({
  title,
  action,
  append,
  children,
  ...props
}: AdmonitionProps) {
  return (
    <Card {...props}>
      <Icon />
      <Content>
        {title && <Title>{title}</Title>}
        {children && <Text>{children}</Text>}
        {append}
      </Content>
      {action && <Actions>{action}</Actions>}
    </Card>
  )
}
