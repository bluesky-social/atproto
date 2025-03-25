import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { Trans } from '@lingui/react/macro'
import { useLingui } from '@lingui/react'
import { msg } from '@lingui/core/macro'
import zod from 'zod'
import { clsx } from 'clsx'

import {
  SecondAuthenticationFactorRequiredError,
  InvalidCredentialsError,
} from '#/api'
import { useValidateHandle } from '#/util/useValidateHandle'
import * as Form from '#/components/forms'
import { Button } from '#/components/Button'
import { InlineLink } from '#/components/Link'
import { format2FACode } from '#/util/format2FACode'
import { useSignInMutation } from '#/data/useSignInMutation'
import { wait } from '#/util/wait'

export const Route = createFileRoute('/_unauthenticated/sign-in')({
  component: RouteComponent,
})

function RouteComponent() {
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
      <LoginForm />
    </div>
  )
}

function LoginForm() {
  const { _ } = useLingui()
  const validateHandle = useValidateHandle()
  const [showCode, setShowCode] = React.useState(false)
  const [error, setError] = React.useState('')
  const { mutateAsync: signIn } = useSignInMutation()

  const form = useForm({
    defaultValues: {
      identifier: '',
      password: '',
      code: '',
      remember: false,
    },
    validators: {
      onSubmit: zod.object({
        identifier: zod.string().superRefine((v, ctx) => {
          if (/.+@/.test(v)) {
            const { success } = zod.string().email().safeParse(v)
            if (!success) {
              ctx.addIssue({
                code: zod.ZodIssueCode.custom,
                message: _(msg`Invalid email`),
              })
            }
          } else {
            const { success, message } = validateHandle(v)
            if (!success) {
              ctx.addIssue({
                code: zod.ZodIssueCode.custom,
                message,
              })
            }
          }
        }),
        password: zod.string().nonempty(_(msg`Password is required`)),
        code: zod.string(),
        remember: zod.boolean(),
      }),
    },
    onSubmit: async ({ value }) => {
      setError('')
      try {
        // throw new SecondAuthenticationFactorRequiredError({
        //   error: 'second_authentication_factor_required',
        //   type: 'emailOtp',
        //   hint: value.identifier,
        // })
        // throw new InvalidCredentialsError({
        //   error: 'invalid_request',
        //   error_description: 'Invalid identifier or password',
        // })
        const res = await wait(
          500,
          signIn({
            username: value.identifier,
            password: value.password,
            remember: value.remember,
          }),
        )
      } catch (e) {
        if (e instanceof SecondAuthenticationFactorRequiredError) {
          setShowCode(true)
        } else if (e instanceof InvalidCredentialsError) {
          setShowCode(false)
          setError(_(msg`Invalid identifier or password.`))
        } else {
          setError(_(msg`An error occurred, please try again.`))
        }
      }
    },
  })

  return (
    <div className="space-y-4">
      <h1 className="text-text-default text-xl font-bold">Sign in</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        <Form.Fieldset label="Test">
          <form.Field
            name="identifier"
            children={(field) => {
              return (
                <Form.Item>
                  <Form.Label name={field.name}>
                    <Trans>Identifier</Trans>
                  </Form.Label>
                  <Form.Text
                    name={field.name}
                    value={field.state.value}
                    placeholder={_(msg`@handle or email`)}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  <Form.Errors errors={field.state.meta.errors} />
                </Form.Item>
              )
            }}
          />
          <form.Field
            name="password"
            children={(field) => {
              return (
                <Form.Item>
                  <Form.Label name={field.name}>
                    <Trans>Password</Trans>
                  </Form.Label>
                  <Form.Text
                    type="password"
                    name={field.name}
                    value={field.state.value}
                    placeholder={_(msg`Password`)}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  <Form.Errors errors={field.state.meta.errors} />
                </Form.Item>
              )
            }}
          />

          {showCode && (
            <form.Field
              name="code"
              children={(field) => {
                return (
                  <Form.Item>
                    <Form.Label name={field.name}>
                      <Trans>Code</Trans>
                    </Form.Label>
                    <Form.Text
                      name={field.name}
                      value={field.state.value}
                      placeholder={_(msg`XXXXX-XXXXX`)}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        field.handleChange(format2FACode(e.target.value))
                      }}
                    />
                  </Form.Item>
                )
              }}
            />
          )}

          <form.Field
            name="remember"
            children={(field) => {
              return (
                <div className="flex items-center space-x-2">
                  <Form.Checkbox
                    name={field.name}
                    value="remember"
                    checked={field.state.value}
                    onChange={(e) => field.handleChange(e.target.checked)}
                  />
                  <Form.Checkbox.Label name={field.name}>
                    <Trans>Remember this account on this device</Trans>
                  </Form.Checkbox.Label>
                </div>
              )
            }}
          />

          {error && (
            <ul>
              <Form.Error>{error}</Form.Error>
            </ul>
          )}

          <div className="pt-2 space-y-3 flex flex-col align-center">
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  <Trans>Sign in</Trans>
                </Button>
              )}
            />

            <InlineLink
              to="/reset-password"
              className="text-sm text-center text-text-light"
            >
              <Trans>Forgot password?</Trans>
            </InlineLink>
          </div>
        </Form.Fieldset>
      </form>
    </div>
  )
}
