import { useCallback, useRef, useState } from 'react'
import { RetryAfterNotice } from '#/components/feedback/retry-after-notice.tsx'
import {
  FormShell,
  type FormShellHandler,
  type FormShellProps,
  type FormValues,
  defaultRenderError,
} from '#/components/forms/form-shell.tsx'
import { HcaptchaChallenge } from '#/components/hcaptcha-challenge.tsx'
import { useCustomizationData } from '#/contexts/customization.tsx'
import { useCountdown } from '#/hooks/use-countdown.ts'
import { useCombinedRef } from '#/hooks/use-merged-refs.ts'
import { CaptchaRequiredError, RateLimitExceededError } from '#/lib/api.ts'
import type { Override } from '#/lib/util.ts'

export type RateLimitedFormProps<
  TValues extends Record<string, unknown> = FormValues,
> = Override<
  FormShellProps<TValues>,
  {
    handler: FormShellHandler<Override<TValues, { hcaptchaToken?: string }>>
  }
>

/**
 * A {@link FormShell} for the endpoints protected by the server's rate limits:
 *
 * - When the server requires a captcha, the challenge is displayed instead of
 *   the error, and the form is re-submitted, with the challenge's token, once
 *   it is solved. A new challenge then runs after every submission, so that a
 *   token is ready for the next one.
 * - When the server rate limits the request, the error is displayed along with
 *   a countdown, and submission is blocked until it ends.
 */
export function RateLimitedForm<TValues extends FormValues>({
  handler,

  // FormShellProps
  ref: forwardedRef,
  submittable = true,
  children,
  ...props
}: RateLimitedFormProps<TValues>) {
  const { hcaptchaSiteKey } = useCustomizationData()
  const [formRef, ref] = useCombinedRef<HTMLFormElement>(forwardedRef)

  const currentHcaptchaTokenRef = useRef<string>(undefined)
  // @NOTE Set while a submission waits for the challenge, which then re-submits
  // the form. Never set after a submission that carried a token: a passive
  // challenge would re-submit with no user interaction, looping until rate
  // limited.
  const awaitingTokenRef = useRef(false)

  const [captchaError, setCaptchaError] = useState<CaptchaRequiredError>()
  // @NOTE Held here rather than thrown to the FormShell, which clears its error
  // on reset: the countdown must stay visible for as long as it blocks.
  const [rateLimitError, setRateLimitError] = useState<RateLimitExceededError>()
  const [countdown, setCountdown] = useCountdown(0)

  // @NOTE Changing the key renders a fresh widget, yielding a new token
  const [hcaptchaRenderKey, reRenderHCaptcha] = useKey()

  // @TODO Should we use a dialog to display the rate limit notice instead of
  // inline?

  return (
    <FormShell<TValues>
      {...props}
      ref={ref}
      submittable={
        submittable &&
        countdown === 0 &&
        (!captchaError || hcaptchaSiteKey != null)
      }
      handler={async (values, signal) => {
        // Tokens are single-use
        const hcaptchaToken = currentHcaptchaTokenRef.current
        currentHcaptchaTokenRef.current = undefined

        // No token is ready yet (the challenge is not solved, or its token
        // expired): the form is re-submitted once a fresh challenge is solved.
        if (captchaError && !hcaptchaToken) {
          awaitingTokenRef.current = true
          reRenderHCaptcha()
          return
        }

        awaitingTokenRef.current = false

        // @NOTE We don't clear the captcha error here as once we start getting
        // captcha challenges, we need to keep sending a captcha tokens with
        // each submission (otherwise the UX would be 1) try to submit without a
        // token, 2) fail and show the captcha challenge again, 3) submit again
        // with the new token).
        setRateLimitError(undefined)

        try {
          await handler({ ...values, hcaptchaToken }, signal)
        } catch (err) {
          if (err instanceof CaptchaRequiredError) {
            setCaptchaError(err)
            // Only a host hook answers this to a request that carried a token
            awaitingTokenRef.current = !hcaptchaToken
          } else if (err instanceof RateLimitExceededError) {
            setRateLimitError(err)
            setCountdown(err?.retryAfter)
          } else {
            throw err
          }
        } finally {
          // Tokens are single-use: get a new one ready for the next submission
          if (hcaptchaToken) reRenderHCaptcha()
        }
      }}
    >
      {children}

      {captchaError != null &&
        // @NOTE The server should only return a captcha error when a hcaptcha
        // is configured: the check bellow is mainly for type safety.
        (hcaptchaSiteKey != null ? (
          <HcaptchaChallenge
            key={hcaptchaRenderKey}
            siteKey={hcaptchaSiteKey}
            onVerify={(token) => {
              currentHcaptchaTokenRef.current = token
              if (awaitingTokenRef.current) {
                awaitingTokenRef.current = false
                formRef.current?.requestSubmit()
              }
            }}
            onExpire={() => {
              currentHcaptchaTokenRef.current = undefined
            }}
          />
        ) : (
          defaultRenderError(captchaError)
        ))}

      {rateLimitError != null &&
        (!rateLimitError.retryAfter || countdown > 0) && (
          <RetryAfterNotice error={rateLimitError} remaining={countdown} />
        )}
    </FormShell>
  )
}

function useKey() {
  const [key, setKey] = useState(0)
  const updateKey = useCallback(() => setKey((k) => k + 1), [])
  return [key, updateKey] as const
}
