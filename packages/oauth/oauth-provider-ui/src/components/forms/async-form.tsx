import { composeEventHandlers } from '@radix-ui/primitive'
import { useAsyncAction } from '#/hooks/use-async-action.ts'
import { Override } from '#/lib/util.ts'
import { FormCard, FormCardProps } from './form-card.tsx'

export type { FormCardProps }

export type AsyncFormProps<T extends NonNullable<unknown>> = Override<
  FormCardProps,
  {
    submitData: T | undefined
    submitHandler: (data: T, signal: AbortSignal) => void | PromiseLike<void>
  }
>

export function AsyncForm<T extends NonNullable<unknown>>({
  submitData,
  submitHandler,

  // FormCardProps
  ...props
}: AsyncFormProps<T>) {
  // @NOTE not using useMutation because it requires a Client instance
  const action = useAsyncAction(async (signal, data: T) => {
    return submitHandler(data, signal)
  })

  return (
    <FormCard
      {...props}
      submittable={props.submittable !== false && submitData != null}
      loading={props.loading || action.loading}
      error={props.error ?? action.error}
      onReset={composeEventHandlers(props.onReset, (event) => {
        event.preventDefault()
        action.reset()
      })}
      onSubmit={composeEventHandlers(props.onSubmit, (event) => {
        event.preventDefault()
        action.run(submitData!)
      })}
    />
  )
}
