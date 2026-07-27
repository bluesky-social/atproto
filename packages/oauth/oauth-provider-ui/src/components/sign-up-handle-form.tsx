import { Trans } from '@lingui/react/macro'
import type { HandleString } from '@atproto/syntax'
import { Notice } from '#/components/feedback/notice.tsx'
import { InputHandleDefault } from '#/components/forms/input-handle-default'
import {
  SmartForm,
  type WrappedSmartFormProps,
} from '#/components/forms/smart-form'

export type SignUpHandleData = {
  handle: HandleString
}

export type SignUpHandleFormProps = WrappedSmartFormProps<SignUpHandleData> & {
  domains: string[]
}

export function SignUpHandleForm({
  domains,

  // FormProp
  ...props
}: SignUpHandleFormProps) {
  return (
    <SmartForm
      {...props}
      validate={({ handle }) => {
        if (handle) return { handle }
      }}
      fields={({ values, setterFor }) => (
        <>
          <InputHandleDefault
            handle={values.handle}
            onHandle={setterFor('handle')}
            domains={domains}
            name="handle"
            required
            autoFocus
            enterKeyHint="done"
            autoComplete="nickname"
          />

          <Notice role="note">
            <Trans>
              You can change this username to any domain name you control after
              your account is set up.
            </Trans>
          </Notice>
        </>
      )}
    />
  )
}
