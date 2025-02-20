import { useCallback, useState } from 'react'
import { CustomizationData } from '../../../backend-data'
import { WizardCard, WizardStep } from '../../../components/forms/wizard-card'
import {
  LayoutTitlePage,
  LayoutTitlePageProps,
} from '../../../components/layouts/layout-title-page'
import { HelpCard } from '../../../components/utils/help-card'
import { Override } from '../../../lib/util'
import {
  SignUpAccountForm,
  SignUpAccountFormOutput,
} from './sign-up-account-form'
import { SignUpDisclaimer } from './sign-up-disclaimer'
import { SignUpHandleForm } from './sign-up-handle-form'
import { SignUpHcaptchaForm } from './sign-up-hcaptcha-form'

export type SignUpViewProps = Override<
  Omit<LayoutTitlePageProps, 'title' | 'subtitle'>,
  {
    customizationData?: CustomizationData

    onBack?: () => void
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
>

export function SignUpView({
  customizationData: {
    availableUserDomains = [],
    hcaptchaSiteKey = undefined,
    inviteCodeRequired = true,
    links,
  } = {},

  onValidateNewHandle,
  onDone,
  onBack,

  // LayoutTitlePage
  ...props
}: SignUpViewProps) {
  const [credentials, setCredentials] = useState<
    undefined | SignUpAccountFormOutput
  >(undefined)
  const [handle, setHandle] = useState<undefined | string>(undefined)
  const [hcaptcha, setHcaptcha] = useState<undefined | string>(undefined)

  const credentialsValid =
    credentials && (!inviteCodeRequired || credentials.inviteCode)
      ? credentials
      : false
  const handleValid = handle ? handle : false
  const hcaptchaValid = hcaptchaSiteKey == null ? undefined : hcaptcha || false

  const doDone = useCallback(
    (signal: AbortSignal) => {
      if (
        credentialsValid !== false &&
        hcaptchaValid !== false &&
        handleValid !== false
      ) {
        return onDone(
          {
            ...credentialsValid,
            handle: handleValid,
            hcaptchaToken: hcaptchaValid,
          },
          signal,
        )
      } else {
        // Should never happen (this would cause the error to appear in the
        // form's error slot)
        throw new Error('Invalid form state')
      }
    },
    [credentialsValid, handleValid, hcaptchaValid],
  )

  const steps: WizardStep<typeof doDone>[] = [
    {
      enabled: true,
      required: credentialsValid === false,
      title: 'Your account',
      content: ({ prev, prevLabel, next, nextLabel, required }) => (
        <SignUpAccountForm
          className="flex-grow"
          invalid={required}
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
    {
      enabled: true,
      required: handleValid === false,
      title: 'Your username',
      content: ({ prev, prevLabel, next, nextLabel, required }) => (
        <SignUpHandleForm
          className="flex-grow"
          invalid={required}
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
      enabled: hcaptchaSiteKey != null,
      required: hcaptchaValid === false,
      title: 'Verify you are human',
      content: ({ prev, prevLabel, next, nextLabel, required }) => (
        <SignUpHcaptchaForm
          className="flex-grow"
          invalid={required}
          siteKey={hcaptchaSiteKey!}
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
  ]

  return (
    <LayoutTitlePage
      {...props}
      title="Create Account"
      subtitle="We're so excited to have you join us!"
    >
      <WizardCard
        steps={steps}
        onBack={onBack}
        onDone={doDone}
        doneLabel="Sign Up"
      />

      <HelpCard className="mt-4" links={links} />
    </LayoutTitlePage>
  )
}
