import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { ReactNode, useCallback, useState } from 'react'
import { useCustomizationData } from '#/contexts/customization.tsx'
import { WizardCard } from './forms/wizard-card.tsx'
import { LayoutTitle } from './layouts/layout-title.tsx'
import {
  SignUpAccountForm,
  SignUpAccountFormOutput,
} from './sign-up-account-form.tsx'
import { SignUpDisclaimer } from './sign-up-disclaimer.tsx'
import { SignUpHandleForm } from './sign-up-handle-form.tsx'
import { SignUpHcaptchaForm } from './sign-up-hcaptcha-form.tsx'
import { HelpCard } from './utils/help-card.tsx'

export type SignUpViewProps = {
  onBack?: () => void
  backLabel?: ReactNode
  onValidateNewHandle: (
    data: { handle: string },
    signal?: AbortSignal,
  ) => void | PromiseLike<void>
  onDone: (
    data: SignUpAccountFormOutput & {
      handle: string
      hcaptchaToken?: string
    },
    signal?: AbortSignal,
  ) => void | PromiseLike<void>
}

export function SignUpView({
  onBack,
  backLabel,
  onValidateNewHandle,
  onDone,
}: SignUpViewProps) {
  const {
    availableUserDomains = [],
    hcaptchaSiteKey = undefined,
    inviteCodeRequired = true,
    links,
  } = useCustomizationData()
  const [credentials, setCredentials] = useState<
    undefined | SignUpAccountFormOutput
  >(undefined)
  const [handle, setHandle] = useState<undefined | string>(undefined)
  const [hcaptcha, setHcaptcha] = useState<undefined | string>(undefined)

  /**
   * "false" indicates that the hcaptcha token is invalid (required but not provided)
   */
  const hcaptchaToken = hcaptchaSiteKey == null ? undefined : hcaptcha || false

  const doDone = useCallback(
    (signal: AbortSignal) => {
      if (credentials && handle && hcaptchaToken !== false) {
        return onDone({ ...credentials, handle, hcaptchaToken }, signal)
      }
    },
    [credentials, handle, hcaptchaToken, onDone],
  )

  return (
    <LayoutTitle
      title={msg({ message: 'Sign up' })}
      subtitle={<Trans>We're so excited to have you join us!</Trans>}
    >
      <WizardCard
        doneLabel={<Trans>Sign up</Trans>}
        onBack={onBack}
        backLabel={backLabel}
        onDone={doDone}
        steps={[
          // We use the handle input first since the "onValidateNewHandle" check
          // will make it less likely that the actual signup call will fail, and
          // will result in a better user experience, especially if there is an
          // issue with the email address (e.g. already in use).
          {
            invalid: !handle,
            titleRender: () => <Trans>Choose a username</Trans>,
            contentRender: ({ prev, prevLabel, next, nextLabel, invalid }) => (
              <SignUpHandleForm
                className="grow"
                invalid={invalid}
                domains={availableUserDomains}
                handle={handle}
                onHandle={setHandle}
                prevLabel={prevLabel}
                onPrev={prev}
                nextLabel={nextLabel}
                onNext={async (signal) => {
                  if (handle) await onValidateNewHandle({ handle }, signal)
                  if (!signal.aborted) return next(signal)
                }}
              >
                <SignUpDisclaimer links={links} />
              </SignUpHandleForm>
            ),
          },
          {
            invalid: !credentials,
            titleRender: () => <Trans>Your account</Trans>,
            contentRender: ({ prev, prevLabel, next, nextLabel, invalid }) => (
              <SignUpAccountForm
                className="grow"
                invalid={invalid}
                prevLabel={prevLabel}
                onPrev={prev}
                nextLabel={nextLabel}
                onNext={next}
                inviteCodeRequired={inviteCodeRequired}
                credentials={credentials}
                onCredentials={setCredentials}
              >
                <SignUpDisclaimer links={links} />
              </SignUpAccountForm>
            ),
          },
          hcaptchaSiteKey != null && {
            invalid: hcaptchaToken === false,
            titleRender: () => <Trans>Verify you are human</Trans>,
            contentRender: ({ prev, prevLabel, next, nextLabel, invalid }) => (
              <SignUpHcaptchaForm
                className="grow"
                invalid={invalid}
                siteKey={hcaptchaSiteKey}
                token={hcaptcha}
                onToken={setHcaptcha}
                prevLabel={prevLabel}
                onPrev={prev}
                nextLabel={nextLabel}
                onNext={next}
              >
                <SignUpDisclaimer links={links} />
              </SignUpHcaptchaForm>
            ),
          },
        ]}
      />

      <HelpCard className="mt-4" links={links} />
    </LayoutTitle>
  )
}
