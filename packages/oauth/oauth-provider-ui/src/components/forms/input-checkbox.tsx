import { composeRefs } from '@radix-ui/react-compose-refs'
import { clsx } from 'clsx'
import { JSX, useRef } from 'react'
import { useRandomString } from '#/hooks/use-random-string.ts'
import { Checkbox } from './checkbox.tsx'
import { useFieldsetContext } from './fieldset-context.tsx'
import { InputContainer } from './input-container.tsx'

export type InputCheckboxProps = Omit<JSX.IntrinsicElements['input'], 'type'>

export function InputCheckbox({
  // input
  className,
  children,
  id,
  ref,
  disabled: disabledProp,
  title,
  'aria-label': ariaLabel = title,
  'aria-labelledby': ariaLabelledBy,
  ...props
}: InputCheckboxProps) {
  const htmlFor = useRandomString('input-checkbox-')
  const labelRef = useRef<HTMLLabelElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const ctx = useFieldsetContext()

  const inputId = id ?? htmlFor
  const disabled = disabledProp ?? ctx.disabled

  return (
    <InputContainer
      className={clsx('cursor-pointer', className)}
      icon={
        <Checkbox
          {...props}
          className="size-4"
          disabled={disabled}
          title={title}
          aria-label={ariaLabel}
          aria-labelledby={
            children
              ? // Prefer the local "<label>" element (through "htmlFor") over the wrapping "<fieldset>" to describe the checkbox.
                undefined
              : ariaLabelledBy ?? ctx.labelId
          }
          ref={composeRefs(ref, inputRef)}
          id={inputId}
        />
      }
      tabIndex={-1}
      onClick={(event) => {
        // Native behavior of clicking the label should toggle the checkbox.
        if (event.target === labelRef.current) return
        if (event.target === inputRef.current) return

        inputRef.current?.click()
        inputRef.current?.focus()
      }}
    >
      {children && (
        <label
          ref={labelRef}
          htmlFor={inputId}
          className="block w-full cursor-pointer select-none leading-[1.6]"
        >
          {children}
        </label>
      )}
    </InputContainer>
  )
}
