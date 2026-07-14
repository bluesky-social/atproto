import { useLingui } from '@lingui/react/macro'
import { KeyIcon } from '@phosphor-icons/react'
import { composeEventHandlers } from '@radix-ui/primitive'
import { composeRefs } from '@radix-ui/react-compose-refs'
import { useRef, useState } from 'react'
import type { Override } from '#/lib/util.ts'
import { ButtonToggleVisibility } from './button-toggle-visibility.tsx'
import { InputText, type InputTextProps } from './input-text.tsx'

export type InputPasswordProps = Override<
  Omit<InputTextProps, 'type'> & {
    value?: string
    defaultValue?: string
  },
  {
    onPassword?: (password: undefined | string) => void
    autoHide?: boolean
  }
>

export function InputPassword({
  autoHide = true,
  onPassword,

  // InputTextProps
  onBlur,
  onChange,
  append,
  autoComplete = 'current-password',
  icon = <KeyIcon className="w-5" weight="bold" />,
  ref,
  title,
  dir = 'auto',
  autoCapitalize = 'none',
  autoCorrect = 'off',
  spellCheck = 'false',
  ...props
}: InputPasswordProps) {
  const { t } = useLingui()
  const inputRef = useRef<HTMLInputElement>(null)
  const [visible, setVisible] = useState<boolean>(false)

  return (
    <InputText
      {...props}
      title={title ?? t`Password`}
      ref={composeRefs(ref, inputRef)}
      dir={dir}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      spellCheck={spellCheck}
      icon={icon}
      onBlur={composeEventHandlers(onBlur, () => {
        if (autoHide) setVisible(false)
      })}
      onChange={composeEventHandlers(onChange, ({ target }) => {
        onPassword?.(target.validity.valid ? target.value : undefined)
      })}
      type={visible ? 'text' : 'password'}
      autoComplete={autoComplete}
      append={
        <>
          <ButtonToggleVisibility
            className="m-1"
            color="darkGrey"
            visible={visible}
            toggleVisible={() => {
              setVisible((prev) => !prev)
              inputRef.current?.focus()
            }}
          />
          {append}
        </>
      }
    />
  )
}
