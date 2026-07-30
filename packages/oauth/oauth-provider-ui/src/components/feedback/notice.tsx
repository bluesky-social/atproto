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
import { Alert, AlertAction, AlertDescription } from '#/components/ui/alert.tsx'
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

// @NOTE Each variant tints its border, surface and icon from the theme's
// branded token (`info` / `warning` / `success` / `destructive`) with opacity
// modifiers, so a deployment's configured branding colours carry through —
// a single RGB per variant, tinted, in place of a per-shade palette.
//
// The shadcn registry's `destructive` alert tints only text and icon, which
// leaves the error reading as uncoloured next to the other three — `error`
// fills the surface so all four carry the same weight.
const variantStyles: Record<NoticeVariant, string> = {
  info: 'border-info/40 bg-info/10 dark:border-info/30',
  success: 'border-success/40 bg-success/10 dark:border-success/30',
  warning: 'border-warning/50 bg-warning/10 dark:border-warning/30',
  error: 'border-destructive/50 bg-destructive/10 dark:border-destructive/40',
}

// @NOTE The important modifier is load-bearing: Alert styles direct-child
// svgs with `*:[svg]:text-current`, whose selector outranks a plain colour
// class on the icon itself.
const iconStyles: Record<NoticeVariant, string> = {
  info: 'text-info!',
  success: 'text-success!',
  warning: 'text-warning!',
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

        {/* @NOTE An <h3> rather than AlertTitle, which renders a <div>: a
          titled alert wants a real heading. */}
        {title && (
          <h3
            data-slot="alert-title"
            className="col-start-2 min-h-4 text-base font-semibold leading-snug tracking-tight"
          >
            {title}
          </h3>
        )}

        {/* @NOTE AlertDescription renders a <div>, so the body copy gets its
          own <p> — the shape its `[&_p]` rules already expect. */}
        {(children || append) && (
          <AlertDescription>
            {children && <p>{children}</p>}
            {append}
          </AlertDescription>
        )}

        {/* @NOTE AlertAction pins the button to `top-2`, which aligns it to the
          title line. A titleless notice is a single row, where that leaves the
          button overhanging the bottom padding — centre it instead. */}
        {action && (
          <AlertAction
            className={cn('right-2.5', !title && 'top-1/2 -translate-y-1/2')}
          >
            {action}
          </AlertAction>
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
