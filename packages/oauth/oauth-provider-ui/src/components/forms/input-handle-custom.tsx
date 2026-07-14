import { useLingui } from '@lingui/react/macro'
import { AtIcon } from '@phosphor-icons/react'
import { composeEventHandlers } from '@radix-ui/primitive'
import {
  type HandleString,
  isValidHandle,
  isValidTld,
  normalizeHandle,
} from '@atproto/syntax'
import type { Override } from '#/lib/util.ts'
import { InputText, type InputTextProps } from './input-text.tsx'

export type InputHandleCustomProps = Override<
  Omit<InputTextProps, 'type' | 'append' | 'bellow'>,
  {
    /** Called whenever the handle becomes valid or invalid. */
    onHandle?: (handle: HandleString | undefined) => void
    /** The current user's DID, shown in the verification instructions. */
    did: string
  }
>

export function InputHandleCustom({
  onHandle,
  did,

  // InputTextProps
  onChange,
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
      onChange={composeEventHandlers(onChange, (event) => {
        onHandle?.(parseHandle(event.target.value))
      })}
    />
  )
}

function parseHandle(value: string): HandleString | undefined {
  const trimmed = normalizeHandle(value.trim())
  if (trimmed.length && isValidHandle(trimmed) && isValidTld(trimmed)) {
    return trimmed
  }
}
