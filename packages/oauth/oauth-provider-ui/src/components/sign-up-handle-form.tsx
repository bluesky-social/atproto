import { Trans } from '@lingui/react/macro'
import type { HandleString } from '@atproto/syntax'
import {
  HandleField,
  composeHandle,
} from '#/components/forms/fields/handle-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'

export type SignUpHandleData = {
  handle: HandleString
}

type HandleFormValues = { handle: string; domain: string }

export type SignUpHandleFormProps = Omit<
  FormShellProps<HandleFormValues>,
  'onSubmit' | 'onValues'
> & {
  domains: string[]
  values?: Partial<SignUpHandleData>
  onValues?: (values: Partial<SignUpHandleData>) => void
  handler: (
    data: SignUpHandleData,
    signal: AbortSignal,
  ) => void | PromiseLike<void>
}

export function SignUpHandleForm({
  domains,
  values,
  onValues,
  handler,
  children,
  ...props
}: SignUpHandleFormProps) {
  return (
    <FormShell<HandleFormValues>
      {...props}
      // @NOTE The wizard stores the composed handle, so both the report and the
      // seed below speak whole handles rather than the two parts.
      onValues={(next) =>
        onValues?.({ handle: composeHandle(next) as HandleString })
      }
      onSubmit={(next, signal) => {
        const handle = composeHandle(next) as HandleString
        onValues?.({ handle })
        return handler({ handle }, signal)
      }}
    >
      <HandleField
        domains={domains}
        defaultHandle={values?.handle}
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
