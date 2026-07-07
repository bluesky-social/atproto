import { Trans, useLingui } from '@lingui/react/macro'
import { type JSX, useMemo, useState } from 'react'
import type { Override } from '#/lib/util.ts'
import { CodeSnippet } from '../utils/code-snippet.tsx'
import { LinkExternal } from '../utils/link-external.tsx'
import { FormField } from './form-field.tsx'
import { InputRadioGroup } from './input-radio-group.tsx'

enum VerificationMethod {
  Dns,
  Http,
}

export type InputHandleCustomInstructionsProps = Override<
  Omit<JSX.IntrinsicElements['div'], 'children'>,
  {
    handle?: string
    did: string
  }
>

type InstructionsMethod = {
  method: VerificationMethod
  label: string
  description?: string
  message: string
  values: ReadonlyArray<{
    label: string
    value: string
    copyable?: boolean
  }>
}

export function InputHandleCustomInstructions({
  handle,
  did,

  // div
  ...props
}: InputHandleCustomInstructionsProps) {
  const { t } = useLingui()
  const [method, setMethod] = useState(VerificationMethod.Dns)

  const instructionsMethods = useMemo<InstructionsMethod[]>(
    () => [
      {
        method: VerificationMethod.Dns,
        label: t`DNS`,
        description: t`If you have access to your domain's DNS configuration panel (e.g. via your domain registrar)`,
        message: t`Add the following record to your domain's DNS configuration.`,
        values: [
          {
            label: t`Host`,
            value: `_atproto.${handle ?? t`<your-domain>`}`,
            copyable: handle != null,
          },
          { label: t`Type`, value: 'TXT' },
          { label: t`Value`, value: `did=${did}` },
        ],
      },
      {
        method: VerificationMethod.Http,
        label: t`HTTP`,
        description: t`If you have access to your domain's web hosting configuration (e.g. via FTP)`,
        message: t`Make a text file with the contents below available at the following URL.`,
        values: [
          {
            label: t`URL`,
            value: `https://${handle ?? t`<your-domain>`}/.well-known/atproto-did`,
            copyable: handle != null,
          },
          { label: t`File contents`, value: did },
        ],
      },
    ],
    [handle, did],
  )

  const currentInstructions: InstructionsMethod =
    instructionsMethods.find((m) => m.method === method) ||
    instructionsMethods[0]

  const tutorialHref =
    'https://bsky.social/about/blog/4-28-2023-domain-handle-tutorial'

  const troubleshootHref = useMemo(() => {
    if (!handle) return undefined
    const url = new URL('https://bsky-debug.app/handle')
    url.searchParams.set('handle', handle)
    return url.toString()
  }, [handle])

  const mailtoHref = useMemo(() => {
    if (!handle) return undefined

    const instructionsText = t`Hello,

To associate the domain "${handle}" with my AT Protocol identity (${did}), one of the following configuration changes is required. Either method is sufficient, only one needs to be applied.

${instructionsMethods
  .map(({ label, message, values }) => {
    return `${label}: ${message}\n${values.map(({ label, value }) => `${label}: ${value}`).join('\n')}`
  })
  .join(`\n\n`)}

The change can be verified by visiting the following URL: ${troubleshootHref}
A detailed tutorial can be found here: ${tutorialHref}

Thank you.`

    return `mailto:?body=${encodeURIComponent(instructionsText)}`
  }, [handle, tutorialHref, troubleshootHref, instructionsMethods])

  return (
    <div {...props}>
      <FormField label={t`Verification method`}>
        <InputRadioGroup
          maxColumns={1}
          value={currentInstructions.method}
          onChange={setMethod}
          options={instructionsMethods.map(
            ({ method, label, description }) => ({
              value: method,
              label,
              description,
            }),
          )}
        />
      </FormField>

      <p className="my-2">{currentInstructions.message}</p>

      {currentInstructions.values.map(({ label, value, copyable }, index) => (
        <CodeSnippet key={index} label={label} copyable={copyable}>
          {value}
        </CodeSnippet>
      ))}

      <p className="my-2 flex flex-row flex-wrap gap-3">
        <LinkExternal
          href={tutorialHref}
          className="text-blue-600 hover:underline"
        >
          <Trans>Help</Trans>
        </LinkExternal>
        <LinkExternal
          href={troubleshootHref}
          className="text-blue-600 hover:underline"
        >
          <Trans>Troubleshoot</Trans>
        </LinkExternal>
        <LinkExternal
          href={mailtoHref}
          noUtm
          className="text-blue-600 hover:underline"
        >
          <Trans>Email these instructions</Trans>
        </LinkExternal>
      </p>
    </div>
  )
}
