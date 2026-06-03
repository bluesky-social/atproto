import { composeEventHandlers } from '@radix-ui/primitive'
import { composeRefs } from '@radix-ui/react-compose-refs'
import { clsx } from 'clsx'
import { JSX, ReactNode, useRef } from 'react'
import { Override } from '#/lib/util.ts'
import { useFieldsetContext } from './fieldset-context.tsx'
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
  title,
  'aria-label': ariaLabel = title,
  'aria-labelledby': ariaLabelledBy,
  placeholder = ariaLabel,
  ...props
}: InputTextProps) {
  const ctx = useFieldsetContext()
  const isDisabled = disabled ?? ctx.disabled

  const inputRef = useRef<HTMLInputElement>(null)
  const focusedRef = useRef(false) // ref instead of state to avoid re-renders

  return (
    <InputContainer
      icon={icon}
      append={append}
      bellow={children}
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
        disabled={isDisabled}
        title={title}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy ?? ctx.labelId}
        ref={composeRefs(ref, inputRef)}
        className={clsx(
          'outline-hidden w-full text-ellipsis bg-transparent bg-clip-padding text-base text-inherit dark:placeholder-gray-400',
          // Disabled state is handled by the parent Fieldset, or parent form element.
          isDisabled ? 'opacity-60' : 'inert:opacity-60',
        )}
        onFocus={composeEventHandlers(onFocus, () => {
          focusedRef.current = true
        })}
        onBlur={composeEventHandlers(onBlur, () => {
          focusedRef.current = false
        })}
      />
    </InputContainer>
  )
}
