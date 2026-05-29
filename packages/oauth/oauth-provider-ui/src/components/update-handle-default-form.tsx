import { composeRefs } from '@radix-ui/react-compose-refs'
import { useRef, useState } from 'react'
import {
  FormCardAsync,
  FormCardAsyncProps,
} from '#/components/forms/form-card-async.tsx'
import { InputHandleDefault } from '#/components/forms/input-handle-default.tsx'
import { Override } from '#/lib/util.ts'

export type UpdateHandleDefaultFormProps = Override<
  FormCardAsyncProps,
  {
    currentHandle?: string
    domains: string[]
    onSubmit: (data: { handle: string }) => void | PromiseLike<void>
  }
>
export function UpdateHandleDefaultForm({
  currentHandle,
  domains,
  onSubmit,

  // FormCardAsync
  ref,
  children,
  ...props
}: UpdateHandleDefaultFormProps) {
  const formRef = useRef<HTMLFormElement>(null)

  const [defaultHandle, setDefaultHandle] = useState<string | undefined>(
    matchesDefaultDomain(currentHandle, domains) ? currentHandle : undefined,
  )

  return (
    <FormCardAsync
      {...props}
      ref={composeRefs(formRef, ref)}
      onSubmit={async () => {
        if (defaultHandle) await onSubmit({ handle: defaultHandle })
      }}
    >
      <InputHandleDefault
        handle={defaultHandle}
        onHandle={(next) => {
          formRef.current?.reset()
          setDefaultHandle(next)
        }}
        domains={domains}
        name="handle"
        required
        autoFocus
        enterKeyHint="done"
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
