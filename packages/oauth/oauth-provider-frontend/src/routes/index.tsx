import React from 'react'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { Trans } from '@lingui/react/macro'
import { useLingui } from '@lingui/react'
import { msg } from '@lingui/core/macro'
import zod from 'zod'
import { clsx } from 'clsx'
import { normalizeAndEnsureValidHandle } from '@atproto/syntax/dist/handle'

import { useValidateHandle } from '#/util/useValidateHandle'
import { useSession } from '#/state/session'
import * as Form from '#/components/forms'
import { Button } from '#/components/Button'
import { InlineLink } from '#/components/Link'
import { format2FACode } from '#/util/format2FACode'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const { session } = useSession()

  return session ? (
    <Navigate to="/sessions" />
  ) : (
    <div
      className={clsx([
        'mx-auto rounded-lg border p-5 md:p-7 shadow-xl dark:shadow-2xl',
        'border-contrast-50 dark:border-contrast-100 shadow-contrast-500/20 dark:shadow-contrast-0/50',
      ])}
      style={{
        marginTop: '10vh',
        maxWidth: 400,
      }}
    >
      <LoginForm />
    </div>
  )
}

function LoginForm() {
  const { _ } = useLingui()
  const { setSession } = useSession()
  const validateHandle = useValidateHandle()
  const [showCode, setShowCode] = React.useState(false)
  const form = useForm({
    defaultValues: {
      identifier: '',
      password: '',
      code: '',
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
        password: zod.string().nonempty(),
        code: zod.string(),
      }),
    },
    onSubmit: async ({ value }) => {
      if (!value.code) {
        setShowCode(true)
        throw new Error('Code is required')
      }
      setSession({
        account: {
          sub: '',
          aud: '',
          email: 'eric@blueskyweb.xyz',
          email_verified: true,
          name: 'Eric',
          preferred_username: '@esb.lol',
          picture:
            'https://cdn.bsky.app/img/avatar/plain/did:plc:3jpt2mvvsumj2r7eqk4gzzjz/bafkreiaexnb3bkzbaxktm5q3l3txyweflh3smcruigesvroqjrqxec4zv4@jpeg',
        },
        selected: false, // what
        loginRequired: false, // what
        consentRequired: false, // what
      })
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
              console.log(field.state.meta)
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
                  {!!field.state.meta.errors.length && (
                    <Form.Errors>
                      {field.state.meta.errors.map((e) => (
                        <Form.Error>{e.message}</Form.Error>
                      ))}
                    </Form.Errors>
                  )}
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

          <div className="pt-2 space-y-3 flex flex-col align-center">
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit]) => (
                <Button type="submit" disabled={!canSubmit}>
                  <Trans>Sign in</Trans>
                </Button>
              )}
            />

            <InlineLink
              to="/sessions"
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
