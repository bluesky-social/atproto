import { ChangeEvent, useCallback, useRef, useState } from 'react'
import { mergeRefs } from '../../lib/ref'
import { Override } from '../../lib/util'
import { LockIcon } from '../utils/icons'
import { ButtonToggleVisibility } from './button-toggle-visibility'
import { InputText, InputTextProps } from './input-text'

export type InputPasswordProps = Override<
  Omit<InputTextProps, 'type'>,
  {
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
  icon = <LockIcon className="w-5" />,
  value,
  defaultValue = value,
  children,
  ref,
  dir = 'auto',
  autoCapitalize = 'none',
  autoCorrect = 'off',
  spellCheck = 'false',
  ...props
}: InputPasswordProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [visible, setVisible] = useState<boolean>(false)
  const [password, setPassword] = useState<string>(
    typeof defaultValue === 'string' ? defaultValue : '',
  )

  const doChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange?.(event)
      setPassword(event.target.value)
    },
    [onChange],
  )

  return (
    <InputText
      placeholder="password"
      aria-label="password"
      title="Password"
      {...props}
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
      value={password}
      onChange={doChange}
      type={visible ? 'text' : 'password'}
      autoComplete={autoComplete}
      append={
        <>
          <ButtonToggleVisibility
            className="m-1"
            visible={visible}
            toggleVisible={() => {
              setVisible((prev) => !prev)
              inputRef.current?.focus()
            }}
          />
          {append}
        </>
      }
    >
      {children}
    </InputText>
  )
}
