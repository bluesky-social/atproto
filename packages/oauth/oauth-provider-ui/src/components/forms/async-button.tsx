import { Loader2Icon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Button } from '#/components/ui/button.tsx'
import { useAsyncAction } from '#/hooks/use-async-action.ts'

export type AsyncButtonProps = Omit<
  ComponentProps<typeof Button>,
  'onClick'
> & {
  action: () => void | PromiseLike<void>
}

/**
 * Runs an async action on click, disabling itself and showing a spinner while
 * it is in flight. Backed by `useAsyncAction`, so the action is aborted on
 * unmount and when superseded.
 */
export function AsyncButton({
  action,
  children,
  disabled,
  ...props
}: AsyncButtonProps) {
  const { run, loading } = useAsyncAction(() => action())

  return (
    <Button
      {...props}
      type="button"
      disabled={disabled || loading}
      onClick={() => void run()}
    >
      {loading && <Loader2Icon className="animate-spin" aria-hidden />}
      {children}
    </Button>
  )
}
