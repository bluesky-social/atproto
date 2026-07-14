import { Trans } from '@lingui/react/macro'
import { type HandleString, isValidHandle } from '@atproto/syntax'
import { InputHandleCustom } from '#/components/forms/input-handle-custom.tsx'
import {
  SmartForm,
  type WrappedSmartFormProps,
} from '#/components/forms/smart-form.tsx'
import { FormField } from './forms/form-field.tsx'
import { InputHandleCustomInstructions } from './forms/input-handle-custom-instructions.tsx'

export type UpdateHandleCustomData = {
  handle: HandleString
}

export type UpdateHandleCustomFormProps =
  WrappedSmartFormProps<UpdateHandleCustomData> & {
    did: string
  }

export function UpdateHandleCustomForm({
  did,

  // FormProps
  ...props
}: UpdateHandleCustomFormProps) {
  return (
    <SmartForm
      {...props}
      validate={({ handle }) => {
        if (handle && isValidHandle(handle)) return { handle }
      }}
      fields={({ values, setterFor }) => (
        <>
          <FormField label={<Trans>Enter the domain you want to use</Trans>}>
            <InputHandleCustom
              defaultValue={values.handle}
              onHandle={setterFor('handle')}
              did={did}
              name="domain"
              required
              autoFocus
              enterKeyHint="done"
            />
          </FormField>

          <InputHandleCustomInstructions
            className="text-sm"
            handle={values.handle}
            did={did}
          />
        </>
      )}
    />
  )
}
