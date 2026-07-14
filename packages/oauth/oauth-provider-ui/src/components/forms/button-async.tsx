import { composeEventHandlers } from '@radix-ui/primitive'
import {
  type AsyncActionHandler,
  useAsyncAction,
} from '#/hooks/use-async-action.ts'
import type { Override } from '#/lib/util.ts'
import { Button, type ButtonProps } from './button.tsx'

export type ButtonAsyncHandler = AsyncActionHandler

export type ButtonAsyncProps = Override<
  ButtonProps,
  {
    action: (signal: AbortSignal) => void | PromiseLike<void>
  }
>

export function ButtonAsync({
  action,

  // ButtonProps
  children,
  onClick,
  loading,
  title,
  ...props
}: ButtonAsyncProps) {
  const handler = useAsyncAction(action)
  return (
    <Button
      {...props}
      loading={handler.loading || loading}
      onClick={composeEventHandlers(onClick, (event) => {
        event.preventDefault()
        void handler.run()
      })}
    >
      {children}
    </Button>
  )
}
