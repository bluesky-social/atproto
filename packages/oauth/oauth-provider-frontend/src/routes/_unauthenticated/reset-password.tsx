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

export const Route = createFileRoute('/_unauthenticated/reset-password')({
  component: RouteComponent,
})

function RouteComponent() {
  const { _ } = useLingui()
  const [showCode, setShowCode] = React.useState(false)

  const form = useForm({
    defaultValues: {
      email: '',
      code: '',
    },
    validators: {
      onSubmit: zod.object({
        email: zod.string().email().nonempty(),
        code: zod.string(),
      }),
    },
    onSubmit: async ({ value }) => {
      if (!value.code) {
        setShowCode(true)
      }
    },
  })

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
      <div className="space-y-4">
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
                      disabled={showCode}
                    />
                    <Form.Errors errors={field.state.meta.errors} />
                  </Form.Item>
                )
              }}
            />

            {showCode && (
              <>
                <div className="pt-4 pb-2">
                  <Divider />
                </div>
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
              </>
            )}

            <div className="pt-2 space-y-3 flex flex-col align-center">
              <form.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
                children={([canSubmit]) => (
                  <Button type="submit" disabled={!canSubmit}>
                    {showCode ? (
                      <Trans>Reset password</Trans>
                    ) : (
                      <Trans>Get reset code</Trans>
                    )}
                  </Button>
                )}
              />

              {showCode ? (
                <p className="text-sm text-center text-text-light">
                  <Trans>
                    Don't see the email?{' '}
                    <InlineLink
                      className="text-sm"
                      label={_(
                        msg`Click here to send a new code to your email.`,
                      )}
                      {...InlineLink.staticClick((e) => {
                        alert('again')
                      })}
                    >
                      Try sending again.
                    </InlineLink>
                  </Trans>
                </p>
              ) : (
                <InlineLink
                  to="/sign-in"
                  className="text-sm text-text-light text-center"
                >
                  <Trans>Back to sign in</Trans>
                </InlineLink>
              )}
            </div>
          </Form.Fieldset>
        </form>
      </div>
    </div>
  )
}
