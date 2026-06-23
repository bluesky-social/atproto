import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import { useCustomizationData } from '#/contexts/customization.tsx'
import { WizardCard } from './forms/wizard-card.tsx'
import { LayoutTitle } from './layouts/layout-title.tsx'
import {
  SignUpCredentialsData,
  SignUpCredentialsForm,
} from './sign-up-credentials-form.tsx'
import { SignUpDisclaimer } from './sign-up-disclaimer.tsx'
import { SignUpHandleData, SignUpHandleForm } from './sign-up-handle-form.tsx'
import {
  SignUpHcaptchaData,
  SignUpHcaptchaForm,
} from './sign-up-hcaptcha-form.tsx'
import { HelpCard } from './utils/help-card.tsx'

export type SignUpViewProps = {
  onBack?: () => void
  onValidateNewHandle: (data: SignUpHandleData) => void | PromiseLike<void>
  onDone: (
    data: SignUpCredentialsData & {
      handle: string
      hcaptchaToken?: string
    },
  ) => void | PromiseLike<void>
}

export function SignUpView({
  onBack,
  onValidateNewHandle,
  onDone,
}: SignUpViewProps) {
  const {
    availableUserDomains = [],
    hcaptchaSiteKey = undefined,
    inviteCodeRequired = true,
    links,
  } = useCustomizationData()

  // Keep a copy of all every step's form values in case the user changes a step
  // and goes back to the previous step, allowing to keep the un-submitted
  // values in the form inputs.
  const [pending, setPending] = useState<
    Partial<SignUpCredentialsData & SignUpHandleData & SignUpHcaptchaData>
  >({})

  return (
    <LayoutTitle
      title={msg({ message: 'Sign up' })}
      subtitle={<Trans>We're so excited to have you join us!</Trans>}
    >
      <WizardCard
        onBack={onBack}
        doneLabel={<Trans>Sign up</Trans>}
        onDone={([handle, credentials, hcaptcha]: [
          SignUpHandleData,
          SignUpCredentialsData,
          SignUpHcaptchaData | null,
        ]) => {
          return onDone({
            ...credentials,
            ...handle,
            hcaptchaToken: hcaptcha?.verify.token,
          })
        }}
        steps={[
          // We use the handle input first since the "onValidateNewHandle" check
          // will make it less likely that the actual signup call will fail, and
          // will result in a better user experience, especially if there is an
          // issue with the email address (e.g. already in use).
          {
            titleRender: () => <Trans>Choose a username</Trans>,
            contentRender: ({ prev, prevLabel, next, nextLabel }) => (
              <SignUpHandleForm
                className="grow"
                domains={availableUserDomains}
                onBack={prev}
                backLabel={prevLabel}
                submitLabel={nextLabel}
                values={pending}
                onValues={(val) => setPending((old) => ({ ...old, ...val }))}
                handler={async (data) => {
                  await onValidateNewHandle(data)
                  next(data)
                }}
              >
                <SignUpDisclaimer links={links} />
              </SignUpHandleForm>
            ),
          },
          {
            titleRender: () => <Trans>Your account</Trans>,
            contentRender: ({ prev, prevLabel, next, nextLabel }) => (
              <SignUpCredentialsForm
                className="grow"
                onBack={prev}
                backLabel={prevLabel}
                submitLabel={nextLabel}
                values={pending}
                onValues={(val) => setPending((old) => ({ ...old, ...val }))}
                handler={next}
                inviteCodeRequired={inviteCodeRequired}
              >
                <SignUpDisclaimer links={links} />
              </SignUpCredentialsForm>
            ),
          },
          hcaptchaSiteKey != null && {
            titleRender: () => <Trans>Verify you are human</Trans>,
            contentRender: ({ prev, prevLabel, next, nextLabel }) => (
              <SignUpHcaptchaForm
                className="grow"
                siteKey={hcaptchaSiteKey}
                onBack={prev}
                backLabel={prevLabel}
                submitLabel={nextLabel}
                values={pending}
                onValues={(val) => setPending((old) => ({ ...old, ...val }))}
                handler={next}
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
