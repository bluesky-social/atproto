import { Trans } from '@lingui/react/macro'
import { composeRefs } from '@radix-ui/react-compose-refs'
import { useRef, useState } from 'react'
import {
  FormCardAsync,
  FormCardAsyncProps,
} from '#/components/forms/form-card-async.tsx'
import { InputHandleCustom } from '#/components/forms/input-handle-custom.tsx'
import { Override } from '#/lib/util.ts'
import { FormField } from './forms/form-field.tsx'
import { InputHandleCustomInstructions } from './forms/input-handle-custom-instructions.tsx'

export type UpdateHandleCustomFormProps = Override<
  FormCardAsyncProps,
  {
    currentHandle?: string
    domains: string[]
    did: string
    onSubmit: (data: { handle: string }) => void | PromiseLike<void>
  }
>

export function UpdateHandleCustomForm({
  currentHandle,
  domains,
  onSubmit,
  did,

  // FormCardAsync
  ref,
  children,
  ...props
}: UpdateHandleCustomFormProps) {
  const formRef = useRef<HTMLFormElement>(null)

  const [customHandle, setCustomHandle] = useState<string | undefined>(
    matchesDefaultDomain(currentHandle, domains) ? undefined : currentHandle,
  )

  return (
    <FormCardAsync
      {...props}
      ref={composeRefs(formRef, ref)}
      onSubmit={async () => {
        if (customHandle) await onSubmit({ handle: customHandle })
      }}
    >
      <FormField label={<Trans>Enter the domain you want to use</Trans>}>
        <InputHandleCustom
          handle={customHandle}
          onHandle={(handle) => {
            formRef.current?.reset()
            setCustomHandle(handle)
          }}
          did={did}
          name="domain"
          required
          autoFocus
          enterKeyHint="done"
        />
      </FormField>

      <InputHandleCustomInstructions
        className="text-sm"
        handle={customHandle}
        did={did}
      />

      {children}
    </FormCardAsync>
  )
}

function matchesDefaultDomain(
  handle: string | undefined,
  domains: string[],
): boolean {
  return handle != null && domains.some((domain) => handle.endsWith(domain))
}
