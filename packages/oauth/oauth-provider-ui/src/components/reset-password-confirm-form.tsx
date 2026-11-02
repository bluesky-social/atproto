import { Trans } from '@lingui/react/macro'
import type { ConfirmResetPasswordInput } from '@atproto/oauth-provider-api'
import { NewPasswordField } from '#/components/forms/fields/new-password-field.tsx'
import { TokenField } from '#/components/forms/fields/token-field.tsx'
import {
  RateLimitedForm,
  type RateLimitedFormProps,
} from '#/components/forms/rate-limited-form.tsx'
import type { WithOptionalLocale } from '#/lib/api'
import type { Override } from '#/lib/util'

export type ResetPasswordConfirmData =
  WithOptionalLocale<ConfirmResetPasswordInput>

export type ResetPasswordConfirmFormProps = Override<
  RateLimitedFormProps<ResetPasswordConfirmData>,
  {
    onResend?: () => void | PromiseLike<void>
    /** For password managers */
    currentUsername?: string
  }
>

export function ResetPasswordConfirmForm({
  currentUsername,
  onResend,

  // RateLimitedFormProps
  ...props
}: ResetPasswordConfirmFormProps) {
  return (
    <RateLimitedForm<{
      token: string
      password: string
    }>
      {...props}
    >
      {currentUsername && (
        // For better password managers integration, we include a hidden
        // username field with the email pre-filled. This allows password
        // managers to associate the reset token and new password with the
        // correct account.
        <input
          type="text"
          autoComplete="username"
          defaultValue={currentUsername}
          readOnly
          hidden
        />
      )}

      <TokenField
        name="token"
        label={<Trans>Reset code</Trans>}
        enterKeyHint="next"
        required
        autoFocus
        onResend={onResend}
      />

      <NewPasswordField
        name="password"
        label={<Trans>New password</Trans>}
        enterKeyHint="done"
        required
      />
    </RateLimitedForm>
  )
}
