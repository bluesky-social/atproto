import type { HandleString } from '@atproto/syntax'
import {
  HandleField,
  composeHandle,
} from '#/components/forms/fields/handle-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'

export type UpdateHandleDefaultData = {
  handle: HandleString
}

type HandleFormValues = { handle: string; domain: string }

export type UpdateHandleDefaultFormProps = Omit<
  FormShellProps<HandleFormValues>,
  'onSubmit'
> & {
  domains: string[]
  /** Seeds the field with the account's current handle. */
  handleDefault?: string
  handler: (
    data: UpdateHandleDefaultData,
    signal: AbortSignal,
  ) => void | PromiseLike<void>
}

export function UpdateHandleDefaultForm({
  domains,
  handleDefault,
  handler,
  ...props
}: UpdateHandleDefaultFormProps) {
  return (
    <FormShell<HandleFormValues>
      {...props}
      // @NOTE The domain check is re-asserted here so submission cannot send a
      // handle outside the available domains.
      onSubmit={(values, signal) => {
        const handle = composeHandle(values) as HandleString
        if (!domains.some((dom) => handle.endsWith(dom))) return
        return handler({ handle }, signal)
      }}
    >
      <HandleField
        domains={domains}
        defaultHandle={handleDefault}
        required
        autoFocus
      />
    </FormShell>
  )
}
