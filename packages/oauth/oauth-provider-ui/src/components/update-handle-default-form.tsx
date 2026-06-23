import { HandleString } from '@atproto/syntax'
import { InputHandleDefault } from '#/components/forms/input-handle-default.tsx'
import { SmartForm, WrappedSmartFormProps } from '#/components/forms/smart-form'

export type UpdateHandleDefaultData = {
  handle: HandleString
}

export type UpdateHandleDefaultFormProps =
  WrappedSmartFormProps<UpdateHandleDefaultData> & {
    domains: string[]
  }

export function UpdateHandleDefaultForm({
  domains,
  ...props
}: UpdateHandleDefaultFormProps) {
  return (
    <SmartForm
      {...props}
      validate={({ handle }) => {
        if (handle && domains.some((dom) => handle.endsWith(dom))) {
          return { handle }
        }
      }}
      fields={({ values, set }) => (
        <InputHandleDefault
          handle={values.handle}
          onHandle={(value) => set('handle', value)}
          domains={domains}
          name="handle"
          required
          autoFocus
          enterKeyHint="done"
        />
      )}
    />
  )
}
