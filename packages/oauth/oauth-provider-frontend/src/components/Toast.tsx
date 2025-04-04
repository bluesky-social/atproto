import { Cross2Icon } from '@radix-ui/react-icons'
import * as ToastBase from '@radix-ui/react-toast'
import { clsx } from 'clsx'
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

type Variant = 'success' | 'warning' | 'error'

type Toast = {
  id: string
  variant: Variant
  title: string
  duration?: number
  dissmissable?: boolean
}

type Context = {
  show(toast: Omit<Toast, 'id'>): void
}

const Context = createContext<Context>({
  show: () => {},
})

const borderColors: Record<Variant, string> = {
  success: 'border-success-200 dark:border-success-900',
  warning: 'border-warning-200 dark:border-warning-900',
  error: 'border-error-200 dark:border-error-900',
}
const bgColors: Record<Variant, string> = {
  success: 'bg-success-50 dark:bg-success-975',
  warning: 'bg-warning-100 dark:bg-warning-975',
  error: 'bg-error-50 dark:bg-error-975',
}
const titleColors: Record<Variant, string> = {
  success: 'text-success-900 dark:text-success-400',
  warning: 'text-warning-800 dark:text-warning-400',
  error: 'text-error-800 dark:text-error-50',
}

const getRandomId = () => {
  const randomId = Math.random().toString(36).substring(2, 8)
  return randomId
}

export function Provider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback<Context['show']>(
    (toast) => {
      setToasts((prev) => [
        ...prev,
        {
          ...toast,
          id: getRandomId(),
        },
      ])
    },
    [setToasts],
  )

  const ctx = useMemo(
    () => ({
      show,
    }),
    [show],
  )

  return (
    <ToastBase.Provider swipeDirection="up">
      <Context.Provider value={ctx}>
        {children}

        {toasts.map((toast) => (
          <ToastBase.Root
            key={toast.id}
            duration={toast.duration}
            onOpenChange={(open) => {
              if (!open) {
                setTimeout(() => {
                  setToasts((prev) => prev.filter((t) => t.id !== toast.id))
                }, 1e3)
              }
            }}
            className={clsx(['ToastRoot', 'py-1'])}
          >
            <div
              className={clsx([
                'relative pl-6 pr-8 py-3 rounded-full shadow-lg border',
                'shadow-contrast-900/15 dark:shadow-contrast-0/60 ',
                borderColors[toast.variant],
                bgColors[toast.variant],
              ])}
            >
              <ToastBase.Title
                className={clsx([
                  'text-sm font-semibold leading-snug',
                  titleColors[toast.variant],
                ])}
              >
                {toast.title}
              </ToastBase.Title>
              {toast.dissmissable && (
                <ToastBase.Close
                  className={clsx([
                    'absolute top-0 bottom-0 my-auto right-2 w-6 h-6 rounded-full border flex items-center justify-center focus:outline-0 transition-colors',
                    'border-contrast-975/30',
                    'hover:bg-contrast-975/30 hover:border-contrast-975/60',
                  ])}
                >
                  <Cross2Icon className="text-text-light hover:text-text-default focus:text-text-default" />
                </ToastBase.Close>
              )}
            </div>
          </ToastBase.Root>
        ))}
      </Context.Provider>

      <ToastBase.Viewport className="fixed top-0 pt-8 left-6 right-6 max-w-[400px] mx-auto" />
    </ToastBase.Provider>
  )
}

export function useToast() {
  return useContext(Context)
}
