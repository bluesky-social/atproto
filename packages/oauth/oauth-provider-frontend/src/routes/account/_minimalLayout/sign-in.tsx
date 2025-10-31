import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useForm } from '@tanstack/react-form'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { useState } from 'react'
import { z } from 'zod'
import {
  InvalidCredentialsError,
  SecondAuthenticationFactorRequiredError,
} from '#/api'
import { Button } from '#/components/Button'
import { InlineLink } from '#/components/Link'
import * as Form from '#/components/forms'
import { useDeviceSessionsQuery } from '#/data/useDeviceSessionsQuery'
import { useSignInMutation } from '#/data/useSignInMutation'
import { format2FACode } from '#/util/format2FACode'
import { wait } from '#/util/wait'
import { normalizeAndEnsureValidHandle } from '@atproto/syntax'

export const Route = createFileRoute('/account/_minimalLayout/sign-in')({
  component: RouteComponent,
})

function RouteComponent() {
  const { data: sessions } = useDeviceSessionsQuery()
  const { _ } = useLingui()

  return (
    <>
      <title>{_(msg`Sign in`)}</title>
      <div
        className={clsx([
          'mx-auto rounded-lg border p-5 shadow-xl md:p-7 dark:shadow-2xl',
          'border-contrast-25 dark:border-contrast-50 shadow-contrast-500/20 dark:shadow-contrast-0/50',
        ])}
        style={{
          maxWidth: 400,
        }}
      >
        <LoginForm />
      </div>

      {sessions.length > 0 && (
        <div className="flex flex-row justify-center pt-4">
          <InlineLink
            to="/account"
            className="text-text-light inline-block w-full text-center text-sm"
          >
            <Trans>&larr; Back to accounts</Trans>
          </InlineLink>
        </div>
      )}
    </>
  )
}

function LoginForm() {
  const { _ } = useLingui()
  const [showCode, setShowCode] = useState(false)
  const [error, setError] = useState('')
  const { mutateAsync: signIn } = useSignInMutation()
  const navigate = useNavigate({ from: Route.fullPath })

  const form = useForm({
    defaultValues: {
      identifier: '',
      password: '',
      code: '',
    },
    validators: {
      onSubmit: z.object({
        identifier: z.union([
          z.string().email(),
          z
            .string()
            .transform((v) => (v.startsWith('@') ? v.slice(1) : v))
            .superRefine((v, ctx) => {
              try {
                return normalizeAndEnsureValidHandle(v)
              } catch (err) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: _(msg`Invalid handle`),
                })
              }
            }),
        ]),
        password: z.string().nonempty(_(msg`Password is required`)),
        code: z.string(),
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
            // @NOTE For some reason, the validator function output is not taken
            // into account here so we have to strip the @ again.
            username: value.identifier.replace(/^@/, ''),
            password: value.password,
            emailOtp: showCode ? value.code : undefined,
          }),
        )
        await navigate({
          to: '/account/$sub',
          params: res.account,
        })
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
      <h1 className="text-custom-primary text-xl font-bold">
        <Trans>Sign in</Trans>
      </h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        <Form.Fieldset label={_(msg`Credentials`)}>
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
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="username"
                    spellCheck="false"
                    type="text"
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
                    name={field.name}
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="current-password"
                    spellCheck="false"
                    type="password"
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
                      autoComplete="one-time-code"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck="false"
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

          {error && (
            <ul>
              <Form.Error>{error}</Form.Error>
            </ul>
          )}

          <div className="align-center space-y-3 pt-2">
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button
                  className="w-full"
                  size="lg"
                  type="submit"
                  disabled={!canSubmit || isSubmitting}
                >
                  <Trans>Sign in</Trans>
                </Button>
              )}
            />

            <InlineLink
              to="/account/reset-password"
              className="text-text-light inline-block w-full text-center text-sm"
            >
              <Trans>Forgot password?</Trans>
            </InlineLink>
          </div>
        </Form.Fieldset>
      </form>
    </div>
  )
}
