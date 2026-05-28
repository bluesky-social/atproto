import { Trans, useLingui } from '@lingui/react/macro'
import { clsx } from 'clsx'
import { useMemo, useState } from 'react'
import { Override } from '#/lib/util.ts'
import { CodeSnippet } from '../utils/code-snippet.tsx'
import { LinkExternal } from '../utils/link-external.tsx'
import { FormField, FormFieldProps } from './form-field.tsx'
import { InputRadioGroup } from './input-radio-group.tsx'

enum VerificationMethod {
  Dns,
  Http,
}

export type InputHandleCustomInstructionsProps = Override<
  Omit<FormFieldProps, 'label' | 'children'>,
  {
    domain?: string
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
  domain,
  did,

  // FormFieldProps
  className,
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
            value: `_atproto.${domain ?? t`<your-domain>`}`,
            copyable: domain != null,
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
            value: `https://${domain ?? t`<your-domain>`}/.well-known/atproto-did`,
            copyable: domain != null,
          },
          { label: t`File contents`, value: did },
        ],
      },
    ],
    [domain, did],
  )

  const currentInstructions: InstructionsMethod =
    instructionsMethods.find((m) => m.method === method) ||
    instructionsMethods[0]

  const tutorialHref =
    'https://bsky.social/about/blog/4-28-2023-domain-handle-tutorial'

  const troubleshootHref = useMemo(() => {
    if (!domain) return undefined
    const url = new URL('https://bsky-debug.app/handle')
    url.searchParams.set('handle', domain)
    return url.toString()
  }, [domain])

  const mailtoHref = useMemo(() => {
    if (!domain) return undefined

    const instructionsText = t`Hello,

To associate the domain "${domain}" with my AT Protocol identity (${did}), one of the following configuration changes is required. Either method is sufficient, only one needs to be applied.

${instructionsMethods
  .map(({ label, message, values }) => {
    return `${label}: ${message}\n${values.map(({ label, value }) => `${label}: ${value}`).join('\n')}`
  })
  .join(`\n\n`)}

The change can be verified by visiting the following URL: ${troubleshootHref}
A detailed tutorial can be found here: ${tutorialHref}

Thank you.`

    return `mailto:?body=${encodeURIComponent(instructionsText)}`
  }, [domain, tutorialHref, troubleshootHref, instructionsMethods])

  return (
    <FormField
      label={<Trans>Instructions</Trans>}
      className={clsx(className, 'text-sm')}
      {...props}
    >
      <div className="border-contrast-25 dark:border-contrast-50 flex flex-col gap-2 rounded-md border border-2 p-3 text-sm">
        <p>
          <Trans>
            To use a custom domain as your username, you first need to prove
            that you control it. Pick a verification method below and follow the
            instructions.
          </Trans>
        </p>
        <FormField label={t`Verification method`}>
          <InputRadioGroup
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

        <p key="message">{currentInstructions.message}</p>

        {currentInstructions.values.map(({ label, value, copyable }, index) => (
          <CodeSnippet
            key={index}
            label={label}
            value={value}
            copyable={copyable}
          />
        ))}

        <p key="links" className="flex flex-row flex-wrap gap-3">
          <LinkExternal
            href={tutorialHref}
            className="text-blue-600 hover:underline"
          >
            <Trans>Learn more</Trans>
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
    </FormField>
  )
}
