import { XIcon } from '@phosphor-icons/react'
import * as ToastBase from '@radix-ui/react-toast'
import { clsx } from 'clsx'
import { createContext, useContext, useMemo, useRef, useState } from 'react'

type Variant = 'success' | 'warning' | 'error' | 'info'

export type NotificationOptions = {
  variant: Variant
  title: string
  description?: string
  duration?: number
}

export interface NotificationHandler {
  update(options: Partial<NotificationOptions>): void
  close(): void
}

export type NotificationsValue = {
  notify(options: NotificationOptions): NotificationHandler
}

const NotificationsContext = createContext<NotificationsValue>({
  notify: (options) => {
    console.warn('Notification triggered without a provider:', options)
    return { update() {}, close() {} }
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
      options: NotificationOptions
    }>
  >([])

  const idRef = useRef(0)

  const value = useMemo<NotificationsValue>(
    () => ({
      notify: (options) => {
        const id = idRef.current++

        const handler: NotificationHandler = {
          update(options) {
            setNotifications((prev) => {
              return prev.map((d) =>
                d.id === id
                  ? { ...d, options: { ...d.options, ...options } }
                  : d,
              )
            })

            if (options.duration != null) {
              clearTimeout(timer)
              timer = setTimeout(handler.close, options.duration)
            }
          },
          close: () => {
            clearTimeout(timer)
            setNotifications((prev) => prev.filter((d) => d.id !== id))
          },
        }

        let timer = setTimeout(handler.close, options.duration ?? duration)
        setNotifications((prev) => [...prev, { id, handler, options }])

        return handler
      },
    }),
    [],
  )

  return (
    <ToastBase.Provider swipeDirection={swipeDirection} duration={0} {...props}>
      <NotificationsContext value={value}>{children}</NotificationsContext>

      {notifications.map(
        ({ id, handler, options: { description, title, variant } }) => (
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
              {title}
            </ToastBase.Title>
            {description && (
              <ToastBase.Description className={clsx(textColors[variant])}>
                {description}
              </ToastBase.Description>
            )}
            <ToastBase.Close
              className="absolute right-4 top-1/2 -translate-y-1/2"
              onClick={handler.close}
            >
              <XIcon className={clsx('size-5', textColors[variant])} />
            </ToastBase.Close>
          </ToastBase.Root>
        ),
      )}

      <ToastBase.Viewport className="fixed bottom-0 left-6 right-6 mx-auto max-w-[400px] pt-8" />
    </ToastBase.Provider>
  )
}

export function useNotificationsContext() {
  return useContext(NotificationsContext)
}
