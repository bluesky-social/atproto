import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { XIcon } from '@phosphor-icons/react'
import * as ToastBase from '@radix-ui/react-toast'
import { clsx } from 'clsx'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import { apiErrorParser } from '#/lib/api-error-parser.ts'
import { parseError } from '#/lib/error-parser.ts'

type Variant = 'success' | 'warning' | 'error' | 'info'

export type NotificationOptions = {
  variant?: Variant
  title: string | MessageDescriptor
  description?: string | MessageDescriptor
  duration?: number
}

export type ErrorNotificationOptions = Partial<NotificationOptions>

export interface NotificationHandler {
  close(): void
}

export type NotificationsValue = {
  notify(options: NotificationOptions): NotificationHandler
  notifyError(
    err: unknown,
    options?: ErrorNotificationOptions,
  ): NotificationHandler
}

const NotificationsContext = createContext<NotificationsValue>({
  notify: (options) => {
    console.warn('Notification triggered without a provider:', options)
    return { close() {} }
  },
  notifyError: (err, _options) => {
    console.error('Error notification triggered without a provider:', err)
    return { close() {} }
  },
})
NotificationsContext.displayName = 'NotificationsContext'

const borderColors: Record<Variant, string> = {
  success: 'border-success-200 dark:border-success-900',
  warning: 'border-warning-200 dark:border-warning-900',
  error: 'border-error-200 dark:border-error-900',
  info: 'border-info-200 dark:border-info-900',
}
const bgColors: Record<Variant, string> = {
  success: 'bg-success-50 dark:bg-success-975',
  warning: 'bg-warning-100 dark:bg-warning-975',
  error: 'bg-error-50 dark:bg-error-975',
  info: 'bg-info-50 dark:bg-info-975',
}
const textColors: Record<Variant, string> = {
  success: 'text-success-900 dark:text-success-400',
  warning: 'text-warning-800 dark:text-warning-400',
  error: 'text-error-800 dark:text-error-50',
  info: 'text-info-900 dark:text-info-400',
}

export function NotificationsProvider({
  children,
  duration = 5000,
  swipeDirection = 'down',
  ...props
}: ToastBase.ToastProviderProps) {
  const [notifications, setNotifications] = useState<
    ReadonlyArray<{
      id: number
      handler: NotificationHandler
      variant: Variant
      title: string | MessageDescriptor
      description?: string | MessageDescriptor
    }>
  >([])

  const idRef = useRef(0)

  const notify = useCallback(
    ({
      variant = 'success',
      title,
      description,
      duration: dur = duration,
    }: NotificationOptions): NotificationHandler => {
      const id = idRef.current++

      const handler: NotificationHandler = {
        close: () => {
          clearTimeout(timer)
          setNotifications((prev) => prev.filter((d) => d.id !== id))
        },
      }

      const timer = setTimeout(handler.close, dur)
      setNotifications((prev) => [
        ...prev,
        { id, handler, variant, title, description },
      ])

      return handler
    },
    [],
  )

  const notifyError = useCallback(
    (err: unknown, options?: ErrorNotificationOptions): NotificationHandler => {
      const { description, message } = apiErrorParser(err) ?? parseError(err)
      return notify({
        ...options,
        variant: options?.variant ?? 'error',
        title: options?.title ?? msg`An error occurred`,
        description: description ?? options?.description ?? message,
      })
    },
    [notify],
  )

  const value = useMemo<NotificationsValue>(
    () => ({ notify, notifyError }),
    [notify, notifyError],
  )

  return (
    <ToastBase.Provider swipeDirection={swipeDirection} duration={0} {...props}>
      <NotificationsContext value={value}>{children}</NotificationsContext>

      {notifications.map(({ id, handler, description, title, variant }) => (
        <ToastBase.Root
          key={id}
          className={clsx(
            'relative mb-4 rounded-2xl border py-3 pl-6 pr-8 shadow-lg',
            'shadow-contrast-900/15 dark:shadow-contrast-0/60',
            borderColors[variant],
            bgColors[variant],
          )}
        >
          <ToastBase.Title
            className={clsx(
              'text-sm font-semibold leading-snug',
              textColors[variant],
            )}
          >
            <Translated message={title} />
          </ToastBase.Title>
          {description && (
            <ToastBase.Description className={clsx(textColors[variant])}>
              <Translated message={description} />
            </ToastBase.Description>
          )}
          <ToastBase.Close
            className="absolute right-4 top-1/2 -translate-y-1/2"
            onClick={handler.close}
          >
            <XIcon className={clsx('size-5', textColors[variant])} />
          </ToastBase.Close>
        </ToastBase.Root>
      ))}

      <ToastBase.Viewport className="fixed bottom-0 left-6 right-6 mx-auto max-w-[400px] pt-8" />
    </ToastBase.Provider>
  )
}

export function useNotificationsContext() {
  return useContext(NotificationsContext)
}

function Translated({ message }: { message: MessageDescriptor | string }) {
  const { _ } = useLingui()
  return <>{typeof message === 'string' ? message : _(message)}</>
}
