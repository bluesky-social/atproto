import { Trans } from '@lingui/react/macro'
import { TicketIcon } from '@phosphor-icons/react'
import { composeEventHandlers } from '@radix-ui/primitive'
import { useRef } from 'react'
import { useMergedRefs } from '#/hooks/use-merged-refs.ts'
import type { Override } from '#/lib/util.ts'
import { ButtonRequestCode } from './button-request-code.tsx'
import { useFieldsetContext } from './fieldset-context.tsx'
import { InputText, type InputTextProps } from './input-text.tsx'

export type InputTokenProps = Override<
  Omit<
    InputTextProps,
    | 'children'
    | 'type'
    | 'pattern'
    | 'autoCapitalize'
    | 'autoCorrect'
    | 'autoComplete'
    | 'spellCheck'
    | 'minLength'
    | 'maxLength'
    | 'placeholder'
    | 'dir'
  >,
  {
    example?: string
    onToken?: (code: string | null) => void
    onResend?: () => void | PromiseLike<void>
  }
>

export const OTP_CODE_EXAMPLE = 'XXXXX-XXXXX'

export function InputToken({
  example = OTP_CODE_EXAMPLE,
  onToken,
  onResend,

  // InputTextProps
  icon = <TicketIcon className="w-5" weight="bold" />,
  title = example,
  autoFocus = false,
  onChange,
  ...props
}: InputTokenProps) {
  const ctx = useFieldsetContext()
  const ref = useRef<HTMLInputElement>(null)
  const refMerged = useMergedRefs(ref, props.ref)

  return (
    <InputText
      {...props}
      ref={refMerged}
      type="text"
      autoFocus={autoFocus}
      autoCapitalize="characters"
      autoCorrect="off"
      autoComplete="one-time-code"
      spellCheck="false"
      minLength={11}
      maxLength={11}
      dir="auto"
      icon={icon}
      pattern="^[A-Z2-7]{5}-[A-Z2-7]{5}$"
      placeholder={example}
      title={title}
      onChange={composeEventHandlers(onChange, (event) => {
        const { value, selectionEnd, selectionStart } = event.currentTarget

        const fixedValue = fix(value)

        event.currentTarget.value = fixedValue

        // Move the cursor back where it was relative to the original value
        const pos = selectionEnd ?? selectionStart
        if (pos != null) {
          const fixedSlicedValue = fix(value.slice(0, pos))
          event.currentTarget.selectionStart =
            event.currentTarget.selectionEnd = fixedSlicedValue.length
        }

        onToken?.(fixedValue.length === 11 ? fixedValue : null)
      })}
    >
      {onResend && (
        <span className="inline-flex items-center text-xs">
          <Trans>
            Didn't receive a code?{' '}
            <ButtonRequestCode
              disabled={ctx.disabled}
              action={async () => {
                await onResend()
                // Next tick to let the time for the disabled state to be
                // applied (after next render) before focusing the input.
                if (autoFocus) setTimeout(() => ref.current?.focus())
              }}
              transparent
              size="xs"
              shape="padded"
              startWithCooldown
            >
              Click here to resend.
            </ButtonRequestCode>
          </Trans>
        </span>
      )}
    </InputText>
  )
}

function fix(value: string) {
  const normalized = value.toUpperCase().replaceAll(/[^A-Z2-7]/g, '')

  if (normalized.length <= 5) return normalized

  return `${normalized.slice(0, 5)}-${normalized.slice(5, 10)}`
}
