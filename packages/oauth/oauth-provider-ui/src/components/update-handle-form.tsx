import { Trans } from '@lingui/react/macro'
import { useRef, useState } from 'react'
import {
  FormCardAsync,
  FormCardAsyncProps,
} from '#/components/forms/form-card-async.tsx'
import { InputHandleCustom } from '#/components/forms/input-handle-custom.tsx'
import { InputHandleProvided } from '#/components/forms/input-handle-provided.tsx'
import { InputRadioGroup } from '#/components/forms/input-radio-group.tsx'
import { mergeRefs } from '#/lib/ref.ts'
import { Override } from '#/lib/util.ts'
import { FormField } from './forms/form-field.tsx'

export type UpdateHandleFormOutput = {
  handle: string
}

export type UpdateHandleFormProps = Override<
  FormCardAsyncProps,
  {
    domains: string[]
    handleDefault?: string
    /** The current user's DID, used in own-domain verification instructions. */
    did: string

    onSubmit: (data: UpdateHandleFormOutput) => void | PromiseLike<void>
  }
>

enum HandleType {
  Default,
  Custom,
}

export function UpdateHandleForm({
  domains,
  handleDefault,
  did,

  onSubmit,

  // FormCardAsyncProps
  invalid,
  ref,
  children,
  ...props
}: UpdateHandleFormProps) {
  const defaultType =
    handleDefault && domains.some((d) => handleDefault.endsWith(d))
      ? HandleType.Default
      : HandleType.Custom

  const [type, setType] = useState(defaultType)

  const [providedHandle, setProvidedHandle] = useState<string | undefined>(
    defaultType === HandleType.Default ? handleDefault : undefined,
  )
  const [customHandle, setCustomHandle] = useState<string | undefined>(
    defaultType === HandleType.Custom ? handleDefault : undefined,
  )

  const formRef = useRef<HTMLFormElement>(null)

  const handle = type === HandleType.Default ? providedHandle : customHandle

  return (
    <FormCardAsync
      {...props}
      ref={mergeRefs([ref, formRef])}
      invalid={!handle || invalid}
      onSubmit={async () => {
        if (handle) await onSubmit({ handle })
      }}
      append={children}
    >
      <FormField label={<Trans>Username type</Trans>}>
        <InputRadioGroup
          value={type}
          onChange={(value) => {
            formRef.current?.reset()
            setType(value)
          }}
          options={[
            {
              value: HandleType.Default,
              label: <Trans>Default domain name</Trans>,
              description: (
                <Trans>
                  e.g. <em>alice{domains[0]}</em>
                </Trans>
              ),
              disabled: !domains.length,
            },
            {
              value: HandleType.Custom,
              label: <Trans>Custom domain name</Trans>,
              description: (
                <Trans>
                  e.g. <em>alice.com</em>
                </Trans>
              ),
            },
          ]}
        />
      </FormField>

      {type === HandleType.Default ? (
        <InputHandleProvided
          handle={providedHandle}
          onHandle={(next) => {
            formRef.current?.reset()
            setProvidedHandle(next)
          }}
          domains={domains}
          name="handle"
          required
          autoFocus
          enterKeyHint="done"
        />
      ) : (
        <InputHandleCustom
          domain={customHandle}
          onDomain={(next) => {
            formRef.current?.reset()
            setCustomHandle(next)
          }}
          did={did}
          name="domain"
          required
          autoFocus
          enterKeyHint="done"
        />
      )}
    </FormCardAsync>
  )
}
