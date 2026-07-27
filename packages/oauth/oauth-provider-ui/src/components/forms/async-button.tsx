import { Loader2Icon } from 'lucide-react'
import { Button } from '#/components/ui/button.tsx'
import { useAsyncAction } from '#/hooks/use-async-action.ts'

export type AsyncButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  'onClick'
> & {
  action: () => void | PromiseLike<void>
}

/**
 * Replaces `forms/button-async.tsx`. Runs an async action on click, disabling
 * itself and showing a spinner while it is in flight.
 *
 * @NOTE Still backed by `useAsyncAction`, so the abort-on-unmount and
 * abort-on-supersede behaviour is unchanged.
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
