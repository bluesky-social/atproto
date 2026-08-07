import type { MessageDescriptor } from '@lingui/core'
import { useLingui } from '@lingui/react'
import { type ReactNode, createContext, useContext, useMemo } from 'react'
import { Toaster, toast } from '#/components/ui/toast.tsx'
import { errorToNotification } from '#/lib/notification-message.ts'

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

export type NotificationsProviderProps = {
  children?: ReactNode
  duration?: number
}

export function NotificationsProvider({
  children,
  duration = 5000,
}: NotificationsProviderProps) {
  const { _ } = useLingui()

  const value = useMemo<NotificationsValue>(() => {
    const translate = (message: string | MessageDescriptor) =>
      typeof message === 'string' ? message : _(message)

    const notify = ({
      variant = 'success',
      title,
      description,
      duration: dur = duration,
    }: NotificationOptions): NotificationHandler => {
      const id = toast.add({
        type: variant,
        title: translate(title),
        description: description ? translate(description) : undefined,
        timeout: dur,
      })

      return { close: () => toast.close(id) }
    }

    const notifyError = (
      err: unknown,
      options?: ErrorNotificationOptions,
    ): NotificationHandler =>
      notify({ ...options, ...errorToNotification(err, options) })

    return { notify, notifyError }
  }, [_, duration])

  return (
    <NotificationsContext value={value}>
      {children}

      {/* @NOTE The toaster lives inside the provider (rather than being mounted
        separately by each entry page) so that a page can never end up with a
        notifications context whose toasts have nowhere to render. */}
      <Toaster />
    </NotificationsContext>
  )
}

export function useNotificationsContext() {
  return useContext(NotificationsContext)
}
