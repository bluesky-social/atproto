import { JSX, ReactNode, useContext, useRef } from 'react'
import { useRandomString } from '../../hooks/use-random-string.ts'
import { clsx } from '../../lib/clsx.ts'
import { mergeRefs } from '../../lib/ref.ts'
import { Override } from '../../lib/util.ts'
import { FieldsetContext } from './fieldset.tsx'
import { InputContainer } from './input-container.tsx'

export type InputCheckboxProps = Override<
  Omit<JSX.IntrinsicElements['input'], 'className' | 'type' | 'children'>,
  {
    className?: string
    children?: ReactNode
  }
>

export function InputCheckbox({
  className,
  children,

  // input
  id,
  ref,
  disabled,
  title,
  'aria-label': ariaLabel = title,
  'aria-labelledby': ariaLabelledBy,
  ...props
}: InputCheckboxProps) {
  const htmlFor = useRandomString('input-checkbox-')
  const labelRef = useRef<HTMLLabelElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const ctx = useContext(FieldsetContext)

  const inputId = id ?? htmlFor

  return (
    <InputContainer
      className={clsx('cursor-pointer', className)}
      icon={
        <input
          {...props}
          disabled={disabled ?? ctx.disabled}
          title={title}
          aria-label={ariaLabel}
          aria-labelledby={
            children
              ? // Prefer the local "<label>" element (through "htmlFor") over the wrapping "<fieldset>" to describe the checkbox.
                undefined
              : ariaLabelledBy ?? ctx.labelId
          }
          ref={mergeRefs([ref, inputRef])}
          id={inputId}
          className="accent-brand outline-none"
          type="checkbox"
        />
      }
      tabIndex={-1}
      onClick={({ target }) => {
        // Native behavior of clicking the label should toggle the checkbox.
        if (target === labelRef.current) return
        if (target === inputRef.current) return

        inputRef.current?.click()
      }}
    >
      {children && (
        <label
          ref={labelRef}
          htmlFor={inputId}
          className="block w-full leading-[1.6] select-none cursor-pointer"
        >
          {children}
        </label>
      )}
    </InputContainer>
  )
}
