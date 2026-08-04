import { useLingui } from '@lingui/react/macro'
import { EyeIcon, EyeOffIcon, KeyIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '#/components/ui/button.tsx'
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
  ...props
}: PasswordFieldProps) {
  const { t } = useLingui()
  const [visible, setVisible] = useState(false)

  return (
    <TextField
      {...props}
      icon={icon}
      title={props.title ?? t`Password`}
      type={visible ? 'text' : 'password'}
      autoComplete={autoComplete}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck="false"
      dir="auto"
      onBlur={(event) => {
        onBlur?.(event)
        if (autoHide) setVisible(false)
      }}
      append={
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={visible ? t`Hide` : t`Make visible`}
            onClick={() => setVisible((prev) => !prev)}
          >
            {visible ? (
              <EyeIcon aria-hidden className="size-5" />
            ) : (
              <EyeOffIcon aria-hidden className="size-5" />
            )}
          </Button>
          {append}
        </>
      }
    />
  )
}
