import {
  forwardRef,
  InputHTMLAttributes,
  MouseEventHandler,
  ReactNode,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { InputContainer } from './input-container'

export type InputTextProps = {
  icon?: ReactNode
  append?: ReactNode
} & InputHTMLAttributes<HTMLInputElement>

export const InputText = forwardRef<HTMLInputElement, InputTextProps>(
  ({ className, icon, append, children, onFocus, onBlur, ...props }, ref) => {
    const [focused, setFocused] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => inputRef.current!, [])

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
        if (focused && event.target !== inputRef.current) {
          // Prevent "blur" event from firing when clicking outside the input
          event.preventDefault()
          event.stopPropagation()
        }
      },
      [focused],
    )

    return (
      <InputContainer
        icon={icon}
        append={append}
        className={className}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
      >
        <input
          {...props}
          ref={inputRef}
          className="w-full bg-transparent bg-clip-padding text-base text-inherit outline-none dark:placeholder-gray-500"
          onFocus={(event) => {
            setFocused(true)
            onFocus?.(event)
          }}
          onBlur={(event) => {
            setFocused(false)
            onBlur?.(event)
          }}
        />
        {children}
      </InputContainer>
    )
  },
)
