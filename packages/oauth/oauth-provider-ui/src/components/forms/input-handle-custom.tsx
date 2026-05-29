import { useLingui } from '@lingui/react/macro'
import { AtIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { isValidHandle, isValidTld, normalizeHandle } from '@atproto/syntax'
import { Override } from '#/lib/util.ts'
import { InputText, InputTextProps } from './input-text.tsx'

export type InputHandleCustomProps = Override<
  Omit<
    InputTextProps,
    'type' | 'value' | 'defaultValue' | 'onChange' | 'append' | 'bellow'
  >,
  {
    /** Initial handle value. */
    handle?: string
    /** Called whenever the handle becomes valid or invalid. */
    onHandle?: (handle: string | undefined) => void
    /** The current user's DID, shown in the verification instructions. */
    did: string
  }
>

export function InputHandleCustom({
  handle: handleInit,
  onHandle,
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
  const [value, setValue] = useState(handleInit)

  return (
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
        onHandle?.(parseHandle(event.target.value))
      }}
    />
  )
}

function parseHandle(value: string): string | undefined {
  const trimmed = normalizeHandle(value.trim())
  const valid =
    trimmed.length > 0 && isValidHandle(trimmed) && isValidTld(trimmed)
  return valid ? trimmed : undefined
}
