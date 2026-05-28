import { Trans } from '@lingui/react/macro'
import { useRef, useState } from 'react'
import { FormCardAsync } from '#/components/forms/form-card-async.tsx'
import { InputHandleCustom } from '#/components/forms/input-handle-custom.tsx'
import { InputHandleProvided } from '#/components/forms/input-handle-provided.tsx'
import { InputRadioGroup } from '#/components/forms/input-radio-group.tsx'
import { Button } from './forms/button.tsx'
import { InputHandleCustomInstructions } from './forms/input-handle-custom-instructions.tsx'
import { WizardCard } from './forms/wizard-card.tsx'
import { LinkExternal } from './utils/link-external.tsx'

export type UpdateHandleFormOutput = {
  handle: string
}

export type UpdateHandleFormProps = {
  domains: string[]
  currentHandle?: string
  /** The current user's DID, used in own-domain verification instructions. */
  did: string

  onSubmit: (data: UpdateHandleFormOutput) => void | PromiseLike<void>
  onCancel?: () => void
}

enum HandleType {
  Default,
  Custom,
}

export function UpdateHandleForm({
  domains,
  currentHandle,
  did,

  onSubmit,
  onCancel,
}: UpdateHandleFormProps) {
  const currentType =
    currentHandle && domains.some((d) => currentHandle.endsWith(d))
      ? HandleType.Default
      : HandleType.Custom

  const [type, setType] = useState(currentType)

  const [providedHandle, setProvidedHandle] = useState<string | undefined>(
    currentType === HandleType.Default ? currentHandle : undefined,
  )
  const [customHandle, setCustomHandle] = useState<string | undefined>(
    currentType === HandleType.Custom ? currentHandle : undefined,
  )

  const formRef = useRef<HTMLFormElement>(null)

  const handle = type === HandleType.Default ? providedHandle : customHandle

  return (
    <WizardCard
      onBack={onCancel}
      backLabel={<Trans>Cancel</Trans>}
      onDone={async () => {
        if (handle) await onSubmit({ handle })
      }}
      doneLabel={<Trans>Save</Trans>}
      steps={[
        {
          titleRender: () => <Trans>New username</Trans>,
          contentRender: ({ prev, prevLabel, next, nextLabel, invalid }) => (
            <FormCardAsync
              invalid={invalid}
              onCancel={prev}
              cancelLabel={prevLabel}
              onSubmit={next}
              submitLabel={nextLabel}
            >
              <p>
                <Trans>
                  If you have your own domain, you can use that as your handle.
                  This lets you self-verify your identity.{' '}
                  <LinkExternal
                    href="https://bsky.social/about/blog/4-28-2023-domain-handle-tutorial"
                    className="text-blue-600 hover:underline"
                  >
                    Learn more here
                  </LinkExternal>
                  .
                </Trans>
              </p>

              <InputRadioGroup
                value={type}
                maxColumns={1}
                onChange={(value) => {
                  formRef.current?.reset()
                  setType(value)
                }}
                options={[
                  {
                    value: HandleType.Default,
                    label: <Trans>Use a default username</Trans>,
                    description: (
                      <Trans>
                        e.g. <em>alice{domains[0]}</em>
                      </Trans>
                    ),
                    disabled: !domains.length,
                  },
                  {
                    value: HandleType.Custom,
                    label: <Trans>Use a domain name I own</Trans>,
                    description: (
                      <Trans>
                        e.g. <em>alice.com</em>
                      </Trans>
                    ),
                  },
                ]}
              />
            </FormCardAsync>
          ),
        },
        {
          invalid: !handle,
          titleRender: () => <Trans>New username</Trans>,
          contentRender:
            type === HandleType.Default
              ? ({ prev, prevLabel, next, nextLabel, invalid }) => (
                  <FormCardAsync
                    invalid={invalid}
                    onCancel={prev}
                    cancelLabel={prevLabel}
                    onSubmit={next}
                    submitLabel={nextLabel}
                    ref={formRef}
                  >
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
                  </FormCardAsync>
                )
              : ({ prev, prevLabel, next, invalid }) => (
                  <FormCardAsync
                    invalid={invalid}
                    onCancel={prev}
                    cancelLabel={prevLabel}
                    onSubmit={next}
                    submitLabel={<Trans>Verify</Trans>}
                    ref={formRef}
                    actions={
                      <Button
                        color="gray"
                        onClick={() => setType(HandleType.Default)}
                      >
                        <Trans>Nevermind, use a default username</Trans>
                      </Button>
                    }
                  >
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

                    <InputHandleCustomInstructions
                      domain={customHandle}
                      did={did}
                    />
                  </FormCardAsync>
                ),
        },
      ]}
    />
  )
}
