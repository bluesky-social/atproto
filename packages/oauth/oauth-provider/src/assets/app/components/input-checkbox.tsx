import { InputHTMLAttributes, useRef, useState } from 'react'
import { InputContainer } from './input-container'

const generateUniqueId = () => Math.random().toString(36).slice(2)

export function InputCheckbox({
  children,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const [id] = useState(generateUniqueId)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <InputContainer
      ref={ref}
      icon={
        <input
          ref={inputRef}
          id={id}
          className="text-brand outline-none"
          type="checkbox"
          {...props}
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
      <label htmlFor={id} className="block w-full leading-[1.6]">
        {children}
      </label>
    </InputContainer>
  )
}
