import { Trans } from '@lingui/react/macro'
import { TicketIcon } from 'lucide-react'
import type { FieldValues } from 'react-hook-form'
import { RequestCodeButton } from '../request-code-button.tsx'
import { TextField, type TextFieldProps } from './text-field.tsx'

export const OTP_CODE_EXAMPLE = 'XXXXX-XXXXX'

export type TokenFieldProps<TValues extends FieldValues> = Omit<
  TextFieldProps<TValues>,
  'type' | 'pattern' | 'minLength' | 'maxLength' | 'placeholder' | 'below'
> & {
  example?: string
  onResend?: () => void | PromiseLike<void>
}

/** Normalises free-typed input into the `XXXXX-XXXXX` OTP shape. */
export function formatToken(value: string) {
  const normalized = value.toUpperCase().replaceAll(/[^A-Z2-7]/g, '')
  if (normalized.length <= 5) return normalized
  return `${normalized.slice(0, 5)}-${normalized.slice(5, 10)}`
}

export function TokenField<TValues extends FieldValues>({
  example = OTP_CODE_EXAMPLE,
  onResend,
  icon = <TicketIcon className="size-5" />,
  title = example,
  autoFocus = false,
  ...props
}: TokenFieldProps<TValues>) {
  return (
    <TextField
      {...props}
      icon={icon}
      type="text"
      autoFocus={autoFocus}
      autoCapitalize="characters"
      autoCorrect="off"
      autoComplete="one-time-code"
      spellCheck="false"
      minLength={11}
      maxLength={11}
      dir="auto"
      pattern="^[A-Z2-7]{5}-[A-Z2-7]{5}$"
      placeholder={example}
      title={title}
      below={
        onResend && (
          <span className="inline-flex items-center text-xs">
            {/* @NOTE The button is child <0> of this Trans block. Do not add,
              remove, or reorder elements inside it — the placeholder indices
              are part of the message id. */}
            <Trans>
              Didn't receive a code?{' '}
              <RequestCodeButton
                action={async () => {
                  await onResend()
                }}
                variant="link"
                size="sm"
                startWithCooldown
              >
                Click here to resend.
              </RequestCodeButton>
            </Trans>
          </span>
        )
      }
    />
  )
}
