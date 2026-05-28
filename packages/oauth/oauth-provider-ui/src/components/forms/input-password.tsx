import { useLingui } from '@lingui/react/macro'
import { KeyIcon } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { mergeRefs } from '#/lib/ref.ts'
import { Override } from '#/lib/util.ts'
import { ButtonToggleVisibility } from './button-toggle-visibility.tsx'
import { InputText, InputTextProps } from './input-text.tsx'

export type InputPasswordProps = Override<
  Omit<InputTextProps, 'type' | 'children' | 'defaultValue' | 'value'>,
  {
    value?: string
    autoHide?: boolean
  }
>

export function InputPassword({
  autoHide = true,

  // InputTextProps
  onBlur,
  onChange,
  append,
  autoComplete = 'current-password',
  icon = <KeyIcon className="w-5" weight="bold" />,
  value: valueInit = '',
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
  const [value, setValue] = useState<string>(valueInit)

  return (
    <InputText
      {...props}
      title={title ?? t`Password`}
      ref={mergeRefs([ref, inputRef])}
      dir={dir}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      spellCheck={spellCheck}
      icon={icon}
      onBlur={
        autoHide
          ? (event) => {
              onBlur?.(event)
              if (!event.defaultPrevented) setVisible(false)
            }
          : onBlur
      }
      value={value}
      onChange={(event) => {
        onChange?.(event)
        setValue(event.target.value)
      }}
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
