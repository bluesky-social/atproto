import { Trans } from '@lingui/react/macro'
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

export type SignUpHandleData = {
  handle: HandleString
}

export type SignUpHandleFormProps = Override<
  FormShellProps<SignUpHandleData>,
  {
    domains: string[]
    defaultValues?: Partial<SignUpHandleData>
  }
>

export function SignUpHandleForm({
  domains,
  defaultValues,

  // FormShellProps
  onValues,
  handler,
  children,
  ...props
}: SignUpHandleFormProps) {
  return (
    <FormShell<NewHandleFieldValues>
      {...props}
      onValues={(next) => {
        onValues?.({ handle: composeHandle(next) })
      }}
      handler={(values, signal) => {
        const handle = composeHandle(values)

        // Fool-proofing (should be ensured by the form validation)
        if (!handle) {
          throw new Error('Invalid handle')
        }

        return handler({ handle }, signal)
      }}
    >
      <NewHandleField
        domains={domains}
        defaultHandle={defaultValues?.handle}
        required
        autoFocus
      />

      {/* @NOTE Plain copy rather than a `Notice`: this is background about a
        later step, not something to act on now, and an alert surface next to
        the field it follows read as a warning about what was just typed. */}
      <p className="text-muted-foreground text-sm">
        <Trans>
          You can change this username to any domain name you control after your
          account is set up.
        </Trans>
      </p>

      {children}
    </FormShell>
  )
}
