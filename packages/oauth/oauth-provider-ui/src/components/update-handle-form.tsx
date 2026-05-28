import { Trans } from '@lingui/react/macro'
import { useRef, useState } from 'react'
import { FormCardAsync } from '#/components/forms/form-card-async.tsx'
import { InputHandleCustom } from '#/components/forms/input-handle-custom.tsx'
import { InputHandleProvided } from '#/components/forms/input-handle-provided.tsx'
import { Button } from './forms/button.tsx'
import { InputHandleCustomInstructions } from './forms/input-handle-custom-instructions.tsx'
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
}: UpdateHandleFormProps) {
  const [type, setType] = useState<HandleType | null>(null)

  const [defaultHandle, setDefaultHandle] = useState<string | undefined>(
    matchesDefaultDomain(currentHandle, domains) ? currentHandle : undefined,
  )
  const [customHandle, setCustomHandle] = useState<string | undefined>(
    matchesDefaultDomain(currentHandle, domains) ? undefined : currentHandle,
  )

  const formRef = useRef<HTMLFormElement>(null)

  if (type === HandleType.Default && domains.length) {
    return (
      <FormCardAsync
        ref={formRef}
        cancelLabel={<Trans>Back</Trans>}
        onCancel={() => setType(null)}
        onSubmit={async () => {
          if (defaultHandle) await onSubmit({ handle: defaultHandle })
        }}
      >
        <InputHandleProvided
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
      </FormCardAsync>
    )
  }

  if (type === HandleType.Custom) {
    return (
      <FormCardAsync
        ref={formRef}
        cancelLabel={<Trans>Back</Trans>}
        onCancel={() => setType(null)}
        submitLabel={<Trans>Verify and Save</Trans>}
        onSubmit={async () => {
          if (customHandle) await onSubmit({ handle: customHandle })
        }}
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
          className="text-sm"
          domain={customHandle}
          did={did}
        />
      </FormCardAsync>
    )
  }

  return (
    <div className="align-stretch flex flex-col gap-4">
      <p>
        <Trans>
          If you have your own domain, you can use that as your handle. This
          lets you self-verify your identity.{' '}
          <LinkExternal
            href="https://bsky.social/about/blog/4-28-2023-domain-handle-tutorial"
            className="text-blue-600 hover:underline"
          >
            Learn more here
          </LinkExternal>
          .
        </Trans>
      </p>

      <Button
        onClick={() => setType(HandleType.Default)}
        disabled={!domains.length}
      >
        <span className="flex w-full flex-col gap-0.5 text-left">
          <span>
            <Trans>Use a default username</Trans>
          </span>
          <span className="text-text-light text-sm leading-snug">
            <Trans>
              e.g. <em>alice{domains[0]}</em>
            </Trans>
          </span>
        </span>
      </Button>

      <Button onClick={() => setType(HandleType.Custom)}>
        <span className="flex w-full flex-col gap-0.5 text-left">
          <span>
            <Trans>Use a domain name I own</Trans>
          </span>
          <span className="text-text-light text-sm leading-snug">
            <Trans>
              e.g. <em>alice.com</em>
            </Trans>
          </span>
        </span>
      </Button>
    </div>
  )
}

function matchesDefaultDomain(
  handle: string | undefined,
  domains: string[],
): boolean {
  return handle != null && domains.some((domain) => handle.endsWith(domain))
}
