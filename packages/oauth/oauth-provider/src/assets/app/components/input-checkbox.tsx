import { InputHTMLAttributes, useRef, useState } from 'react'
import { InputContainer } from './input-container'

const generateUniqueId = () => Math.random().toString(36).slice(2)

export type InputCheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
>

export function InputCheckbox({
  id,
  children,
  className,
  ...props
}: InputCheckboxProps) {
  const [htmlFor] = useState(generateUniqueId)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <InputContainer
      id={id}
      ref={ref}
      icon={
        <input
          {...props}
          ref={inputRef}
          id={htmlFor}
          className="text-brand outline-none"
          type="checkbox"
        />
      }
      className={className}
      onClick={(event) => {
        if (event.target === ref.current && !event.defaultPrevented) {
          inputRef.current?.click()
          inputRef.current?.focus()
        }
      }}
    >
      <label htmlFor={htmlFor} className="block w-full leading-[1.6]">
        {children}
      </label>
    </InputContainer>
  )
}
