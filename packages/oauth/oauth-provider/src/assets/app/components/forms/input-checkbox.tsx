import { JSX, ReactNode, useContext, useMemo, useRef } from 'react'
import { clsx } from '../../lib/clsx.ts'
import { mergeRefs } from '../../lib/ref.ts'
import { Override } from '../../lib/util.ts'
import { FieldsetContext } from './fieldset.tsx'
import { InputContainer } from './input-container.tsx'

const generateUniqueId = () => Math.random().toString(36).slice(2)

export type InputCheckboxProps = Override<
  Omit<
    JSX.IntrinsicElements['input'],
    'className' | 'type' | 'id' | 'children'
  >,
  {
    id?: string
    className?: string
    children?: ReactNode
  }
>

export function InputCheckbox({
  id,
  className,
  children,

  // input
  ref,
  disabled,
  'aria-labelledby': ariaLabelledBy,
  ...props
}: InputCheckboxProps) {
  const htmlFor = useMemo(generateUniqueId, [])
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const ctx = useContext(FieldsetContext)

  return (
    <InputContainer
      id={id}
      ref={containerRef}
      className={clsx('cursor-pointer', className)}
      icon={
        <input
          {...props}
          disabled={disabled ?? ctx.disabled}
          aria-labelledby={
            children
              ? undefined // Prefer the local "<label>" element over the wrapping "<fieldset>" to describe the checkbox.
              : ariaLabelledBy ?? ctx.labelId
          }
          ref={mergeRefs([ref, inputRef])}
          id={htmlFor}
          className="accent-brand outline-none"
          type="checkbox"
        />
      }
      tabIndex={-1}
      onClick={(event) => {
        if (event.target === containerRef.current && !event.defaultPrevented) {
          inputRef.current?.click()
          inputRef.current?.focus()
        }
      }}
    >
      {children && (
        <label
          htmlFor={htmlFor}
          className="block w-full leading-[1.6] select-none cursor-pointer"
        >
          {children}
        </label>
      )}
    </InputContainer>
  )
}
