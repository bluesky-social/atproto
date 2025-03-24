import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import clsx from 'clsx'
import { useForm } from '@tanstack/react-form'
import { Trans } from '@lingui/react/macro'
import { useLingui } from '@lingui/react'
import { msg } from '@lingui/core/macro'
import zod from 'zod'

import * as Form from '#/components/forms'
import { Button } from '#/components/Button'
import { InlineLink } from '#/components/Link'
import { format2FACode } from '#/util/format2FACode'
import { Divider } from '#/components/Divider'
import { usePasswordResetMutation } from '#/data/usePasswordResetMutation'
import { usePasswordConfirmMutation } from '#/data/usePasswordConfirmMutation'
import { wait } from '#/util/wait'
import { ButtonLink } from '#/components/Link'

export const Route = createFileRoute('/_unauthenticated/reset-password')({
  component: RouteComponent,
})

function RouteComponent() {
  const { _ } = useLingui()
  const [showConfirmStep, setShowConfirmStep] = React.useState(false)
  const [showSuccess, setShowSuccess] = React.useState(false)
  const [error, setError] = React.useState('')
  const { mutateAsync: resetPassword } = usePasswordResetMutation()
  const { mutateAsync: confirmPassword } = usePasswordConfirmMutation()

  const form = useForm({
    defaultValues: {
      email: '',
    },
    validators: {
      onSubmit: zod.object({
        email: zod
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
      code: '',
      password: '',
    },
    validators: {
      onSubmit: zod.object({
        code: zod.string().nonempty(_(msg`Email code is required`)),
        password: zod
          .string()
          .nonempty(_(msg`A new password is required`))
          .min(8, _(msg`Password must be at least 8 characters`)),
      }),
    },
    onSubmit: async ({ value }) => {
      setError('')
      try {
        await wait(
          500,
          confirmPassword({ code: value.code, password: value.password }),
        )
        setShowSuccess(true)
      } catch (e) {
        setError(_(msg`An error occurred, please try again.`))
      }
    },
  })

  const resendCode = async () => {
    try {
      await resetPassword({ email: form.getFieldValue('email') })
      // TODO success
    } catch (e) {
      // TODO error
    }
  }

  return (
    <div
      className={clsx([
        'mx-auto rounded-lg border p-5 md:p-7 shadow-xl dark:shadow-2xl',
        'border-contrast-25 dark:border-contrast-50 shadow-contrast-500/20 dark:shadow-contrast-0/50',
      ])}
      style={{
        maxWidth: 400,
      }}
    >
      <div className="space-y-4 w-full">
        {showSuccess ? (
          <>
            <div className="space-y-1">
              <h1 className="text-text-default text-xl font-bold">
                <Trans>Success!</Trans>
              </h1>
              <p className="text-text-light">
                <Trans>Your password has been reset.</Trans>
              </p>
            </div>
            <ButtonLink to="/sign-in">
              <Trans>Back to sign in</Trans>
            </ButtonLink>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <h1 className="text-text-default text-xl font-bold">
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

                    <div className="pt-2 space-y-3 flex flex-col align-center">
                      <form.Subscribe
                        selector={(state) => [
                          state.canSubmit,
                          state.isSubmitting,
                        ]}
                        children={([canSubmit, isSubmitting]) => (
                          <Button
                            type="submit"
                            disabled={!canSubmit || isSubmitting}
                          >
                            <Trans>Get reset code</Trans>
                          </Button>
                        )}
                      />

                      <InlineLink
                        to="/sign-in"
                        className="text-sm text-text-light text-center"
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
                    <div className="pt-4 pb-2">
                      <Divider />
                    </div>
                    <confirmForm.Field
                      name="code"
                      children={(field) => {
                        return (
                          <Form.Item>
                            <Form.Label name={field.name}>
                              <Trans>Code</Trans>
                            </Form.Label>
                            <Form.Text
                              autoComplete="off"
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
                        return (
                          <Form.Item>
                            <Form.Label name={field.name}>
                              <Trans>Password</Trans>
                            </Form.Label>
                            <Form.Text
                              type="password"
                              autoComplete="off"
                              name={field.name}
                              value={field.state.value}
                              placeholder={_(msg`Enter a new password`)}
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
                  </>

                  {error && (
                    <ul>
                      <Form.Error>{error}</Form.Error>
                    </ul>
                  )}

                  <div className="pt-2 space-y-3 flex flex-col align-center">
                    <confirmForm.Subscribe
                      selector={(state) => [
                        state.canSubmit,
                        state.isSubmitting,
                      ]}
                      children={([canSubmit, isSubmitting]) => (
                        <Button
                          type="submit"
                          disabled={!canSubmit || isSubmitting}
                        >
                          <Trans>Reset password</Trans>
                        </Button>
                      )}
                    />

                    <p className="text-sm text-center text-text-light">
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
