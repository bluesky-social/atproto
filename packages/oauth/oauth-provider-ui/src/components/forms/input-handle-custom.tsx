import { Trans, useLingui } from '@lingui/react/macro'
import { AtIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { isValidHandle, isValidTld, normalizeHandle } from '@atproto/syntax'
import { Override } from '#/lib/util.ts'
import { FormField } from './form-field.tsx'
import { InputHandleCustomInstructions } from './input-handle-custom-instructions.tsx'
import { InputText, InputTextProps } from './input-text.tsx'

export type InputHandleCustomProps = Override<
  Omit<
    InputTextProps,
    'type' | 'value' | 'defaultValue' | 'onChange' | 'append' | 'bellow'
  >,
  {
    /** Initial domain value. */
    domain?: string
    /** Called whenever the domain becomes valid or invalid. */
    onDomain?: (domain: string | undefined) => void
    /** The current user's DID, shown in the verification instructions. */
    did: string
  }
>

export function InputHandleCustom({
  domain: domainInput,
  onDomain,
  did,

  // InputTextProps
  autoCapitalize = 'none',
  autoComplete = 'off',
  autoCorrect = 'off',
  dir = 'auto',
  icon = <AtIcon aria-hidden weight="bold" className="size-5" />,
  title,
  placeholder,
  ...props
}: InputHandleCustomProps) {
  const { t } = useLingui()
  const [value, setValue] = useState(domainInput)
  const [domain, setDomain] = useState<string | undefined>(domainInput)

  return (
    <div className="flex flex-col space-y-4">
      <FormField label={<Trans>Username</Trans>}>
        <InputText
          {...props}
          type="text"
          title={title ?? t`Type your domain`}
          placeholder={placeholder ?? t`alice.com`}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={autoCorrect}
          dir={dir}
          icon={icon}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            const domain = parseDomain(event.target.value)
            setDomain(domain)
            onDomain?.(domain)
          }}
        />
      </FormField>

      <InputHandleCustomInstructions domain={domain} did={did} />
    </div>
  )
}

function parseDomain(value: string): string | undefined {
  const trimmed = normalizeHandle(value.trim())
  const valid =
    trimmed.length > 0 && isValidHandle(trimmed) && isValidTld(trimmed)
  return valid ? trimmed : undefined
}
