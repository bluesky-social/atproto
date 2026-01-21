import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useForm } from '@tanstack/react-form'
import { createFileRoute } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { useState } from 'react'
import { z } from 'zod'
import { Button } from '#/components/Button'
import { Divider } from '#/components/Divider'
import { ButtonLink, InlineLink } from '#/components/Link'
import { useToast } from '#/components/Toast'
import * as Form from '#/components/forms'
import { usePasswordConfirmMutation } from '#/data/usePasswordConfirmMutation'
import { usePasswordResetMutation } from '#/data/usePasswordResetMutation'
import { format2FACode } from '#/util/format2FACode'
import { MIN_PASSWORD_LENGTH, getPasswordStrength } from '#/util/passwords'
import { wait } from '#/util/wait'

export const Route = createFileRoute('/account/_minimalLayout/reset-password')({
  component: RouteComponent,
})

function RouteComponent() {
  const { _ } = useLingui()

  return (
    <>
      <title>{_(msg`Reset password`)}</title>
      <ResetPassword />
    </>
  )
}

function ResetPassword() {
  const { _ } = useLingui()
  const [showConfirmStep, setShowConfirmStep] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState('')
  const { mutateAsync: resetPassword } = usePasswordResetMutation()
  const { mutateAsync: confirmPassword } = usePasswordConfirmMutation()
  const { show } = useToast()

  const form = useForm({
    defaultValues: {
      email: '',
    },
    validators: {
      onSubmit: z.object({
        email: z
          .string()
          .email(_(msg`Invalid email`))
          .nonempty(_(msg`Email is required`)),
      }),
    },
    onSubmit: async ({ value }) => {
      setError('')
      try {
        await wait(500, resetPassword({ email: value.email }))
        setShowConfirmStep(true)
      } catch (e) {
        setError(_(msg`An error occurred, please try again.`))
      }
    },
  })
  const confirmForm = useForm({
    defaultValues: {
      token: '',
      password: '',
    },
    validators: {
      onSubmit: z.object({
        token: z.string().nonempty(_(msg`Email code is required`)),
        password: z
          .string()
          .nonempty(_(msg`A new password is required`))
          .min(
            MIN_PASSWORD_LENGTH,
            _(msg`Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
          ),
      }),
    },
    onSubmit: async ({ value }) => {
      setError('')
      try {
        await wait(500, confirmPassword(value))
        setShowSuccess(true)
      } catch (e) {
        setError(_(msg`An error occurred, please try again.`))
      }
    },
  })

  const resendCode = async () => {
    try {
      await resetPassword({ email: form.getFieldValue('email') })
      show({
        variant: 'success',
        title: _(msg`Code was resent`),
        duration: 2e3,
      })
    } catch (e) {
      show({
        variant: 'error',
        title: _(msg`Failed to resend code`),
        duration: 2e3,
      })
    }
  }

  return (
    <div
      className={clsx([
        'mx-auto rounded-lg border p-5 shadow-xl md:p-7 dark:shadow-2xl',
        'border-contrast-25 dark:border-contrast-50 shadow-contrast-500/20 dark:shadow-contrast-0/50',
      ])}
      style={{
        maxWidth: 400,
      }}
    >
      <div className="w-full space-y-4">
        {showSuccess ? (
          <>
            <div className="space-y-1">
              <h1 className="text-custom-primary text-xl font-bold">
                <Trans>Success!</Trans>
              </h1>
              <p className="text-text-light">
                <Trans>Your password has been reset.</Trans>
              </p>
            </div>
            <ButtonLink size="lg" to="/account/sign-in">
              <Trans>Back to sign in</Trans>
            </ButtonLink>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <h1 className="text-custom-primary text-xl font-bold">
                <Trans>Reset password</Trans>
              </h1>
              <p className="text-text-light">
                <Trans>Enter your email to receive a reset code.</Trans>
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                e.stopPropagation()
                form.handleSubmit()
              }}
            >
              <Form.Fieldset label="Test">
                <form.Field
                  name="email"
                  children={(field) => {
                    return (
                      <Form.Item>
                        <Form.Label name={field.name} hidden>
                          <Trans>Email</Trans>
                        </Form.Label>
                        <Form.Text
                          name={field.name}
                          autoCapitalize="none"
                          autoCorrect="off"
                          autoComplete="email"
                          spellCheck="false"
                          type="email"
                          enterKeyHint="next"
                          value={field.state.value}
                          placeholder={_(msg`Enter your email`)}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          disabled={showConfirmStep}
                        />
                        <Form.Errors errors={field.state.meta.errors} />
                      </Form.Item>
                    )
                  }}
                />

                {!showConfirmStep && (
                  <>
                    {error && (
                      <ul>
                        <Form.Error>{error}</Form.Error>
                      </ul>
                    )}

                    <div className="align-center space-y-3 pt-2">
                      <form.Subscribe
                        selector={(state) => [
                          state.canSubmit,
                          state.isSubmitting,
                        ]}
                        children={([canSubmit, isSubmitting]) => (
                          <Button
                            className="w-full"
                            size="lg"
                            type="submit"
                            disabled={!canSubmit || isSubmitting}
                          >
                            <Trans>Get reset code</Trans>
                          </Button>
                        )}
                      />

                      <InlineLink
                        to="/account/sign-in"
                        className="text-text-light inline-block w-full text-center text-sm"
                      >
                        <Trans>Back to sign in</Trans>
                      </InlineLink>
                    </div>
                  </>
                )}
              </Form.Fieldset>
            </form>

            {showConfirmStep && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  confirmForm.handleSubmit()
                }}
              >
                <Form.Fieldset label="Test">
                  <>
                    <div className="pb-2 pt-4">
                      <Divider />
                    </div>
                    <confirmForm.Field
                      name="token"
                      children={(field) => {
                        return (
                          <Form.Item>
                            <Form.Label name={field.name}>
                              <Trans>Code</Trans>
                            </Form.Label>
                            <Form.Text
                              autoComplete="one-time-code"
                              autoCapitalize="characters"
                              autoCorrect="off"
                              spellCheck="false"
                              enterKeyHint="next"
                              name={field.name}
                              value={field.state.value}
                              placeholder={_(msg`XXXXX-XXXXX`)}
                              onBlur={field.handleBlur}
                              onChange={(e) => {
                                field.handleChange(
                                  format2FACode(e.target.value),
                                )
                              }}
                            />
                            <Form.Errors errors={field.state.meta.errors} />
                          </Form.Item>
                        )
                      }}
                    />
                    <confirmForm.Field
                      name="password"
                      children={(field) => {
                        const isMin =
                          field.state.value.length >= MIN_PASSWORD_LENGTH
                        const strength = getPasswordStrength(field.state.value)
                        const defaultBg = 'bg-contrast-300 dark:bg-contrast-300'
                        const strengthBg =
                          strength >= 3
                            ? 'bg-success-500'
                            : strength === 2
                              ? 'bg-warning-500'
                              : 'bg-error-500'
                        return (
                          <Form.Item>
                            <Form.Label name={field.name}>
                              <Trans>Password</Trans>
                            </Form.Label>
                            <Form.Text
                              type="password"
                              autoComplete="new-password"
                              autoCapitalize="none"
                              autoCorrect="off"
                              spellCheck="false"
                              enterKeyHint="done"
                              minLength={MIN_PASSWORD_LENGTH}
                              name={field.name}
                              value={field.state.value}
                              placeholder={_(msg`Enter a new password`)}
                              onBlur={field.handleBlur}
                              onChange={(e) => {
                                field.handleChange(e.target.value)
                              }}
                            />
                            <div className="flex space-x-2">
                              {Array.from({ length: 4 }).map((_, i) => (
                                <div
                                  className={clsx([
                                    'h-1 w-full rounded-full',
                                    strength > i && isMin
                                      ? strengthBg
                                      : defaultBg,
                                  ])}
                                />
                              ))}
                            </div>
                            <Form.Errors errors={field.state.meta.errors} />
                          </Form.Item>
                        )
                      }}
                    />
                  </>

                  {error && (
                    <ul>
                      <Form.Error>{error}</Form.Error>
                    </ul>
                  )}

                  <div className="align-center space-y-3 pt-2">
                    <confirmForm.Subscribe
                      selector={(state) => [
                        state.canSubmit,
                        state.isSubmitting,
                      ]}
                      children={([canSubmit, isSubmitting]) => (
                        <Button
                          className="w-full"
                          size="lg"
                          type="submit"
                          disabled={!canSubmit || isSubmitting}
                        >
                          <Trans>Reset password</Trans>
                        </Button>
                      )}
                    />

                    <p className="text-text-light inline-block w-full text-center text-sm">
                      <Trans>
                        Don't see the email?{' '}
                        <InlineLink
                          className="text-sm"
                          label={_(
                            msg`Click here to send a new code to your email.`,
                          )}
                          {...InlineLink.staticClick(() => {
                            resendCode()
                          })}
                        >
                          Try sending again.
                        </InlineLink>
                      </Trans>
                    </p>
                  </div>
                </Form.Fieldset>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
