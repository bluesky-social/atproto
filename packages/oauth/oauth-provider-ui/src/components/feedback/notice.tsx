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

// @NOTE Opacity modifiers on the branded tokens, so a deployment's configured
// colours carry through. `error` fills its surface unlike the shadcn
// registry's `destructive` alert, which tints only text and icon and so reads
// as uncoloured beside the other three.
const variantStyles: Record<NoticeVariant, string> = {
  info: 'border-info/40 bg-info/10 dark:border-info/30',
  success: 'border-success/40 bg-success/10 dark:border-success/30',
  warning: 'border-warning/50 bg-warning/10 dark:border-warning/30',
  error: 'border-destructive/50 bg-destructive/10 dark:border-destructive/40',
}

// @NOTE `!` outranks the registry Alert's own `*:[svg]:text-current`.
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
        className={cn(
          variantStyles[variant],
          // @NOTE `!` throughout: the registry Alert's own `has-[>svg]:`
          // template wins on specificity, and its `*:[svg]:` rules tie, where
          // stylesheet order rather than class order decides.
          action && 'grid-cols-[auto_1fr_auto]!',
          // An action sets the row height, leaving the copy and the icon
          // top-aligned against a taller button. Only worth centring when
          // there is no title to align them to instead.
          action &&
            !title &&
            '*:[svg]:row-span-1! *:[svg]:translate-y-0! items-center',
          className,
        )}
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
          own <p> — the shape its `[&_p]` rules already expect. Plain wrapping
          at every width: the registry balances line lengths below `md` and
          avoids orphans above it, and in a container this narrow both hold the
          copy short of its own right edge, reading as stray padding. */}
        {(children || append) && (
          <AlertDescription className="text-wrap md:text-wrap">
            {children && <p>{children}</p>}
            {append}
          </AlertDescription>
        )}

        {/* @NOTE A real column, not the registry's AlertAction: that overlays
          the copy on a fixed `pr-18` reservation, which a button wider than
          4.5rem — in any locale — overflows. */}
        {action && (
          <div
            data-slot="notice-action"
            className="col-start-3 row-start-1 self-center"
          >
            {action}
          </div>
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
