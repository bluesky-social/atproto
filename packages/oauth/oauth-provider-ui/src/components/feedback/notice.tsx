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

// @NOTE The shadcn palette has no success/warning tokens, only `destructive`.
// Rather than inventing tokens (which would have to be re-derived when branding
// is layered back in), these two tint the border, surface and icon from
// Tailwind's built-in palette — matching the weight of the warning alert in
// shadcn's own examples, which carries its colour as a background fill and not
// just an outline.
//
// `error` takes the same treatment from the `destructive` token. Upstream's
// `destructive` variant tints only the text and icon, leaving `bg-card` and the
// default border — a deliberate deviation, so that all three coloured variants
// read at the same weight instead of the error alone looking uncoloured.
const variantStyles: Record<NoticeVariant, string> = {
  info: 'border-border',
  success:
    'border-emerald-500/40 bg-emerald-500/10 dark:border-emerald-400/30 dark:bg-emerald-400/10',
  warning:
    'border-amber-500/50 bg-amber-500/10 dark:border-amber-400/30 dark:bg-amber-400/10',
  error: 'border-destructive/50 bg-destructive/10 dark:border-destructive/40',
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

        {/* @NOTE AlertAction pins the button to `top-2`, which is right for the
          shadcn example — a title above a description, with the button aligned
          to the title line. A titleless notice is a single 20px row, and a
          28px button pinned 8px from the top of a 40px box overhangs the
          bottom padding (9px above, 3px below). Centre it in that case.
          `right-2.5` matches the alert's own `px-2.5`. */}
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
