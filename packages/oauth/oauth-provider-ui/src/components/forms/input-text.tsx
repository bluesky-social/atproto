import { clsx } from 'clsx'
import { JSX, ReactNode, useContext, useRef } from 'react'
import { mergeRefs } from '../../lib/ref.ts'
import { Override } from '../../lib/util.ts'
import { FieldsetContext } from './fieldset.tsx'
import { InputContainer } from './input-container.tsx'

export type InputTextProps = Override<
  Omit<JSX.IntrinsicElements['input'], 'children'>,
  {
    icon?: ReactNode
    append?: ReactNode
    bellow?: ReactNode
    className?: string
  }
>

export function InputText({
  icon,
  append,
  bellow,
  className,

  // input
  onFocus,
  onBlur,
  ref,
  disabled,
  title,
  'aria-label': ariaLabel = title,
  'aria-labelledby': ariaLabelledBy,
  placeholder = ariaLabel,
  ...props
}: InputTextProps) {
  const ctx = useContext(FieldsetContext)

  const inputRef = useRef<HTMLInputElement>(null)
  const focusedRef = useRef(false) // ref instead of state to avoid re-renders

  return (
    <InputContainer
      icon={icon}
      append={append}
      bellow={bellow}
      className={clsx('cursor-text', className)}
      tabIndex={-1}
      actionable={false}
      onClick={(event) => {
        if (inputRef.current !== event.target) {
          event.preventDefault()
          event.stopPropagation()
          inputRef.current?.focus()
        }
      }}
      onMouseDown={(event) => {
        if (focusedRef.current && event.target !== inputRef.current) {
          // Prevent "blur" event from firing when clicking outside the input
          event.preventDefault()
          event.stopPropagation()
        }
      }}
    >
      <input
        {...props}
        disabled={disabled ?? ctx.disabled}
        title={title}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy ?? ctx.labelId}
        ref={mergeRefs([ref, inputRef])}
        className="outline-hidden w-full text-ellipsis bg-transparent bg-clip-padding text-base text-inherit dark:placeholder-gray-500"
        onFocus={(event) => {
          onFocus?.(event)
          if (!event.defaultPrevented) focusedRef.current = true
        }}
        onBlur={(event) => {
          onBlur?.(event)
          if (!event.defaultPrevented) focusedRef.current = false
        }}
      />
    </InputContainer>
  )
}
