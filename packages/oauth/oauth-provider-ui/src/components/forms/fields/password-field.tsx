import { useLingui } from '@lingui/react/macro'
import { EyeIcon, EyeOffIcon, KeyIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '#/components/ui/button.tsx'
import { useCombinedRef } from '#/hooks/use-merged-refs.ts'
import { composeEventHandlers } from '#/lib/compose-event-handlers.ts'
import { TextField, type TextFieldProps } from './text-field.tsx'

export type PasswordFieldProps = Omit<
  TextFieldProps,
  'type' | 'autoCapitalize' | 'autoCorrect' | 'dir' | 'spellCheck'
> & {
  /** Re-hide the value when the field loses focus. */
  autoHide?: boolean
}

export function PasswordField({
  autoHide = true,
  autoComplete = 'current-password',
  icon = <KeyIcon className="size-5" />,
  append,
  onBlur,
  ref: forwardedRef,
  ...props
}: PasswordFieldProps) {
  const { t } = useLingui()
  const [visible, setVisible] = useState(false)

  const [inputRef, ref] = useCombinedRef<HTMLInputElement>(forwardedRef)

  return (
    <TextField
      {...props}
      ref={ref}
      icon={icon}
      title={props.title ?? t`Password`}
      type={visible ? 'text' : 'password'}
      autoComplete={autoComplete}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck="false"
      dir="auto"
      onBlur={composeEventHandlers(onBlur, (event) => {
        if (autoHide) {
          const isOutside = !event.currentTarget.parentNode?.contains(
            event.relatedTarget,
          )
          if (isOutside) setVisible(false)
        }
      })}
      append={
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={visible ? t`Hide` : t`Make visible`}
            onClick={() => {
              setVisible((prev) => !prev)
              setTimeout(() => {
                inputRef.current?.focus()
                inputRef.current?.setSelectionRange(
                  inputRef.current.value.length,
                  inputRef.current.value.length,
                )
              })
            }}
          >
            {visible ? (
              <EyeIcon aria-hidden className="size-4" />
            ) : (
              <EyeOffIcon aria-hidden className="size-4" />
            )}
          </Button>
          {append}
        </>
      }
    />
  )
}
