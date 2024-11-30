import { ReactNode, useCallback, useState } from 'react'

import { LinkDefinition } from '../backend-data'
import { HelpCard } from '../components/help-card'
import { LayoutTitlePage } from '../components/layout-title-page'
import {
  SignUpAccountForm,
  SignUpAccountFormOutput,
} from '../components/sign-up-account-form'
import { SignUpDisclaimer } from '../components/sign-up-disclaimer'
import { Button } from '../components/button'

export type SignUpViewProps = {
  stepName?: (step: number, total: number) => ReactNode
  stepTitle?: (step: number, total: number) => ReactNode

  links?: LinkDefinition[]
  onSignUp: (data: {
    username: string
    password: string
    extra?: Record<string, string>
  }) => void | PromiseLike<void>
  onBack?: () => void
}

export function SignUpView({
  stepName = (step, total) => `Step ${step} of ${total}`,
  stepTitle = (step, total) => {
    switch (step) {
      case 1:
        return 'Your account'
      default:
        return null
    }
  },

  links,

  onSignUp,
  onBack,
}: SignUpViewProps) {
  const [_credentials, setCredentials] =
    useState<null | SignUpAccountFormOutput>(null)
  const [step, setStep] = useState<1 | 2>(1)

  const stepCount = 2

  const doSubmitAccount = useCallback(
    (credentials: SignUpAccountFormOutput) => {
      setCredentials(credentials)
      setStep(2)
    },
    [onSignUp, setCredentials, setStep],
  )

  return (
    <LayoutTitlePage
      title="Create Account"
      subtitle="We're so excited to have you join us!"
    >
      <div className="flex flex-col">
        <p className="mt-4 text-slate-400 dark:text-slate-600">
          {stepName(step, stepCount)}
        </p>
        <h2 className="font-medium text-xl mb-4">
          {stepTitle(step, stepCount)}
        </h2>

        {step === 1 && (
          <SignUpAccountForm
            className="flex-grow"
            onSubmit={doSubmitAccount}
            onCancel={onBack}
            cancelLabel="Back"
          >
            <SignUpDisclaimer links={links} />
          </SignUpAccountForm>
        )}

        {step === 2 && <Button onClick={() => setStep(1)}>Back</Button>}

        <HelpCard className="mb-4" links={links} />
      </div>
    </LayoutTitlePage>
  )
}
