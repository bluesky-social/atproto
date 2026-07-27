import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  type LucideIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import {
  type AriaRole,
  type JSX,
  type ReactNode,
  createContext,
  useContext,
  useMemo,
} from 'react'
import { Alert, AlertDescription } from '#/components/ui/alert.tsx'
import { Button, type buttonVariants } from '#/components/ui/button.tsx'
import type { Override } from '#/lib/util.ts'
import { cn } from '#/lib/utils.ts'

export type NoticeVariant = 'info' | 'warning' | 'error' | 'success'

const ROLE_VARIANT_MAP: ReadonlyMap<AriaRole, NoticeVariant> = new Map([
  ['note', 'info'],
  ['status', 'warning'],
  ['warning', 'warning'],
  ['alert', 'error'],
])

const roleToVariant = (role?: AriaRole): NoticeVariant => {
  return (
    (ROLE_VARIANT_MAP as ReadonlyMap<unknown, NoticeVariant>).get(role) ??
    'info'
  )
}

const icons: Record<NoticeVariant, LucideIcon> = {
  info: InfoIcon,
  success: CircleCheckIcon,
  warning: TriangleAlertIcon,
  error: CircleAlertIcon,
}

// @NOTE The neutral shadcn palette has no success/warning tokens, only
// `destructive`. Rather than inventing tokens (which would have to be
// re-derived when branding is layered back in), the non-error variants tint
// the border and icon from Tailwind's built-in palette and leave the alert
// surface neutral.
const variantStyles: Record<NoticeVariant, string> = {
  info: 'border-border',
  success: 'border-emerald-500/40 dark:border-emerald-400/30',
  warning: 'border-amber-500/50 dark:border-amber-400/30',
  error: '',
}

const iconStyles: Record<NoticeVariant, string> = {
  info: 'text-muted-foreground',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-500',
  error: '',
}

type NoticeContextValue = { variant: NoticeVariant }

const NoticeContext = createContext<NoticeContextValue>({ variant: 'info' })
NoticeContext.displayName = 'NoticeContext'

export type NoticeProps = Override<
  JSX.IntrinsicElements['div'],
  {
    role: AriaRole
    variant?: NoticeVariant
    title?: ReactNode
    action?: ReactNode
    append?: ReactNode
    icon?: LucideIcon
  }
>

export function Notice({
  role,
  variant = roleToVariant(role),
  title,
  action,
  append,
  icon,
  className,
  children,
  ...props
}: NoticeProps) {
  const value = useMemo(() => ({ variant }), [variant])
  const Icon = icon ?? icons[variant]

  return (
    <NoticeContext value={value}>
      <Alert
        role={role}
        variant={variant === 'error' ? 'destructive' : 'default'}
        className={cn(variantStyles[variant], className)}
        {...props}
      >
        <Icon className={iconStyles[variant]} aria-hidden />

        {/* @NOTE AlertTitle is a <div> upstream, but the previous Admonition
          rendered its title in an <h3> and the pds e2e suite asserts
          `ensureTextVisibility('Avertissement', 'h3')`. Keeping a real heading
          is also the correct semantics for a titled alert. */}
        {title && (
          <h3
            data-slot="alert-title"
            className="col-start-2 min-h-4 text-base font-semibold leading-snug tracking-tight"
          >
            {title}
          </h3>
        )}

        {/* @NOTE AlertDescription is a <div> upstream. The body copy is wrapped
          in an explicit <p> because the pds e2e helper
          `ensureTextVisibility(text, 'p')` looks for a <p>, and because
          AlertDescription styles `[&_p]` for exactly this shape. */}
        {(children || append) && (
          <AlertDescription>
            {children && <p>{children}</p>}
            {append}
          </AlertDescription>
        )}

        {action && (
          <div className="col-start-2 mt-2 flex justify-end">{action}</div>
        )}
      </Alert>
    </NoticeContext>
  )
}

export type NoticeActionProps = Override<
  JSX.IntrinsicElements['button'],
  {
    variant?: Parameters<typeof buttonVariants>[0] extends infer P
      ? P extends { variant?: infer V }
        ? V
        : never
      : never
  }
>

export function NoticeAction({
  variant,
  size = 'sm',
  ...props
}: NoticeActionProps & { size?: 'default' | 'sm' | 'lg' | 'icon' }) {
  const { variant: noticeVariant } = useContext(NoticeContext)

  return (
    <Button
      size={size}
      variant={
        variant ?? (noticeVariant === 'error' ? 'destructive' : 'secondary')
      }
      {...props}
    />
  )
}
