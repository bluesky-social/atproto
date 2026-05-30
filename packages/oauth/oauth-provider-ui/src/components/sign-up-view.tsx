import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { useMemo, useState } from 'react'
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

  // Each step's data
  const [data, setData] = useState<{
    credentials?: SignUpCredentialsData
    handle?: SignUpHandleData
    hcaptcha?: SignUpHcaptchaData
  }>({})

  const doneValue = useMemo(() => {
    if (!data.credentials || !data.handle) return null
    if (hcaptchaSiteKey != null && !data.hcaptcha) return null

    return {
      ...data.credentials,
      ...data.handle,
      hcaptchaToken:
        hcaptchaSiteKey == null ? undefined : data.hcaptcha?.verify.token,
    }
  }, [data, hcaptchaSiteKey])

  return (
    <LayoutTitle
      title={msg({ message: 'Sign up' })}
      subtitle={<Trans>We're so excited to have you join us!</Trans>}
    >
      <WizardCard
        doneLabel={<Trans>Sign up</Trans>}
        onBack={onBack}
        onDone={() => {
          if (doneValue) void onDone(doneValue)
        }}
        steps={[
          // We use the handle input first since the "onValidateNewHandle" check
          // will make it less likely that the actual signup call will fail, and
          // will result in a better user experience, especially if there is an
          // issue with the email address (e.g. already in use).
          {
            invalid: !data.handle,
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
                  setData((prev) => ({ ...prev, handle: data }))
                  next()
                }}
              >
                <SignUpDisclaimer links={links} />
              </SignUpHandleForm>
            ),
          },
          {
            invalid: !data.credentials,
            titleRender: () => <Trans>Your account</Trans>,
            contentRender: ({ prev, prevLabel, next, nextLabel }) => (
              <SignUpCredentialsForm
                className="grow"
                onBack={prev}
                backLabel={prevLabel}
                submitLabel={nextLabel}
                values={pending}
                onValues={(val) => setPending((old) => ({ ...old, ...val }))}
                handler={async (data) => {
                  setData((prev) => ({ ...prev, credentials: data }))
                  next()
                }}
                inviteCodeRequired={inviteCodeRequired}
              >
                <SignUpDisclaimer links={links} />
              </SignUpCredentialsForm>
            ),
          },
          hcaptchaSiteKey != null && {
            invalid: !data.hcaptcha,
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
                handler={async (data) => {
                  setData((prev) => ({ ...prev, hcaptcha: data }))
                  next()
                }}
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
