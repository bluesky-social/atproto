import type { HandleString } from '@atproto/syntax'
import {
  NewHandleField,
  type NewHandleFieldValues,
  composeHandle,
} from '#/components/forms/fields/new-handle-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
import type { Override } from '#/lib/util'

export type UpdateHandleDefaultData = {
  handle: HandleString
}

export type UpdateHandleDefaultFormProps = Override<
  FormShellProps<UpdateHandleDefaultData>,
  {
    domains: string[]
    /** Seeds the field with the account's current handle. */
    handleDefault?: string
  }
>

export function UpdateHandleDefaultForm({
  domains,
  handleDefault,
  handler,
  onValues,
  ...props
}: UpdateHandleDefaultFormProps) {
  return (
    <FormShell<NewHandleFieldValues>
      {...props}
      onValues={(next) => {
        const handle = composeHandle(next)
        onValues?.({ handle })
      }}
      handler={(values, signal) => {
        const handle = composeHandle(values)
        // @NOTE The domain check is re-asserted here so submission cannot send a
        // handle outside the available domains.
        if (!handle || !domains.some((dom) => handle.endsWith(dom))) return
        return handler({ handle }, signal)
      }}
    >
      <NewHandleField
        domains={domains}
        defaultHandle={handleDefault}
        required
        autoFocus
      />
    </FormShell>
  )
}
