import { Trans } from '@lingui/react/macro'
import { composeRefs } from '@radix-ui/react-compose-refs'
import { ReactNode, useEffect, useRef } from 'react'
import {
  FormCardAsync,
  FormCardAsyncProps,
} from '#/components/forms/form-card-async.tsx'
import { InputHandleProvided } from '#/components/forms/input-handle-provided'
import { Admonition } from '#/components/utils/admonition.tsx'
import { Override } from '#/lib/util.ts'

export type SignUpHandleFormProps = Override<
  Omit<
    FormCardAsyncProps,
    'append' | 'onCancel' | 'cancelLabel' | 'onSubmit' | 'submitLabel'
  >,
  {
    domains: string[]

    onNext: () => void | PromiseLike<void>
    nextLabel?: ReactNode

    onPrev?: () => void
    prevLabel?: ReactNode

    handle?: string
    onHandle?: (handle: string | undefined) => void
  }
>

export function SignUpHandleForm({
  domains,

  onNext,
  nextLabel,

  onPrev,
  prevLabel,

  handle: handleInit,
  onHandle,

  // FormCardProps
  invalid,
  children,
  ref,
  ...props
}: SignUpHandleFormProps) {
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    // Whenever the user changes the handle, abort any pending form action
    formRef.current?.reset()
  }, [handleInit])

  return (
    <FormCardAsync
      {...props}
      ref={composeRefs(ref, formRef)}
      onCancel={onPrev}
      cancelLabel={prevLabel}
      onSubmit={onNext}
      submitLabel={nextLabel}
      invalid={invalid || !handleInit}
      append={children}
    >
      <InputHandleProvided
        handle={handleInit}
        onHandle={onHandle}
        domains={domains}
        name="handle"
        required
        autoFocus
        enterKeyHint="done"
      />

      <Admonition role="note">
        <Trans>
          You can change this username to any domain name you control after your
          account is set up.
        </Trans>
      </Admonition>
    </FormCardAsync>
  )
}
