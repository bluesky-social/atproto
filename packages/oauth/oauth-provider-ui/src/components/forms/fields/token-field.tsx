import { Trans } from '@lingui/react/macro'
import { TicketIcon } from 'lucide-react'
import { useRef } from 'react'
import { useMergedRefs } from '#/hooks/use-merged-refs.ts'
import { OTP_CODE_PATTERN, formatOtpCode } from '#/lib/form-patterns.ts'
import { RequestCodeButton } from '../request-code-button.tsx'
import { TextField, type TextFieldProps } from './text-field.tsx'

export const OTP_CODE_EXAMPLE = 'XXXXX-XXXXX'

export type TokenFieldProps = Omit<
  TextFieldProps,
  'type' | 'pattern' | 'minLength' | 'maxLength' | 'placeholder' | 'below'
> & {
  example?: string
  onResend?: () => void | PromiseLike<void>
}

export function TokenField({
  example = OTP_CODE_EXAMPLE,
  onResend,
  icon = <TicketIcon className="size-5" />,
  title = example,
  autoFocus = false,
  ref,
  onChange,
  ...props
}: TokenFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const mergedRef = useMergedRefs(inputRef, ref)

  return (
    <TextField
      {...props}
      ref={mergedRef}
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
      pattern={OTP_CODE_PATTERN}
      placeholder={example}
      title={title}
      // @NOTE Runs before Base UI's own change handler (`mergeProps` calls the
      // outer handler first), so rewriting the element's value here is what
      // Base UI, a controlled `value`, and `FormShell`'s `onInput` all observe.
      onChange={(event) => {
        const input = event.currentTarget
        const { value, selectionStart, selectionEnd } = input

        const formatted = formatOtpCode(value)
        if (formatted !== value) {
          input.value = formatted

          // Keep the caret where it was relative to the characters that
          // survived formatting, rather than letting it jump to the end.
          const pos = selectionEnd ?? selectionStart
          if (pos != null) {
            const caret = formatOtpCode(value.slice(0, pos)).length
            input.setSelectionRange(caret, caret)
          }
        }

        onChange?.(event)
      }}
      below={
        onResend && (
          <span className="inline-flex items-center text-xs">
            {/* @NOTE The button is child <0> of this Trans block. Do not add,
              remove, or reorder elements inside it — the placeholder indices
              are part of the message id. */}
            <Trans>
              Didn't receive a code?{' '}
              {/* @NOTE Sits inside a sentence, so the button is stripped of its
                block height and padding and rendered as inline link text. */}
              <RequestCodeButton
                action={async () => {
                  await onResend()
                  // Next tick, so the button's disabled state has been applied
                  // (after the next render) before focus moves to the input.
                  if (autoFocus) setTimeout(() => inputRef.current?.focus())
                }}
                variant="link"
                size="sm"
                className="text-foreground h-auto gap-1 px-1 py-0 text-xs underline-offset-2 disabled:opacity-100 [&_[data-slot=request-code-label]]:underline [&_svg]:hidden"
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
