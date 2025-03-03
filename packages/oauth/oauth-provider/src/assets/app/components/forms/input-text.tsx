import {
  JSX,
  MouseEventHandler,
  ReactNode,
  useCallback,
  useContext,
  useRef,
} from 'react'
import { mergeRefs } from '../../lib/ref.ts'
import { Override } from '../../lib/util.ts'
import { FieldsetContext } from './fieldset.tsx'
import { InputContainer } from './input-container.tsx'

export type InputTextProps = Override<
  JSX.IntrinsicElements['input'],
  {
    icon?: ReactNode
    append?: ReactNode
    className?: string
  }
>

export function InputText({
  icon,
  append,
  className,

  // input
  children,
  onFocus,
  onBlur,
  ref,
  disabled,
  'aria-labelledby': ariaLabelledBy,
  ...props
}: InputTextProps) {
  const ctx = useContext(FieldsetContext)

  const inputRef = useRef<HTMLInputElement>(null)
  const focusedRef = useRef(false) // ref instead of state to avoid re-renders

  const handleClick = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      if (inputRef.current !== event.target) {
        event.preventDefault()
        event.stopPropagation()
        inputRef.current?.focus()
      }
    },
    [],
  )

  const handleMouseDown = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      if (focusedRef.current && event.target !== inputRef.current) {
        // Prevent "blur" event from firing when clicking outside the input
        event.preventDefault()
        event.stopPropagation()
      }
    },
    [],
  )

  return (
    <InputContainer
      icon={icon}
      append={append}
      className={className}
      tabIndex={-1}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      <input
        {...props}
        disabled={disabled ?? ctx.disabled}
        aria-labelledby={ariaLabelledBy ?? ctx.labelId}
        ref={mergeRefs([ref, inputRef])}
        className="w-full bg-transparent bg-clip-padding text-base text-inherit outline-none dark:placeholder-gray-500"
        onFocus={(event) => {
          onFocus?.(event)
          if (!event.defaultPrevented) focusedRef.current = true
        }}
        onBlur={(event) => {
          onBlur?.(event)
          if (!event.defaultPrevented) focusedRef.current = false
        }}
      />
      {children}
    </InputContainer>
  )
}
