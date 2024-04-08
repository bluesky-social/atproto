import { ReactNode, useCallback, useEffect, useState } from 'react'

import {
  ExtraFieldDefinition,
  FieldDefinition,
  LinkDefinition,
} from '../backend-data'
import { HelpCard } from '../components/help-card'
import { LayoutTitlePage } from '../components/layout-title-page'
import {
  SignUpAccountForm,
  SignUpAccountFormOutput,
} from '../components/sign-up-account-form'
import { SignUpDisclaimer } from '../components/sign-up-disclaimer'
import { upsert } from '../lib/util'

export type SignUpViewProps = {
  stepName?: (step: number, total: number) => ReactNode
  stepTitle?: (step: number, total: number) => ReactNode

  links?: LinkDefinition[]
  fields?: {
    username?: FieldDefinition
    password?: FieldDefinition
  }
  extraFields?: Record<string, ExtraFieldDefinition>
  onSignUp: (data: {
    username: string
    password: string
    extra?: Record<string, string>
  }) => void | PromiseLike<void>
  onBack?: () => void
}

const defaultStepName: NonNullable<SignUpViewProps['stepName']> = (
  step,
  total,
) => `Step ${step} of ${total}`
const defaultStepTitle: NonNullable<SignUpViewProps['stepTitle']> = (
  step,
  total,
) => {
  switch (step) {
    case 1:
      return 'Your account'
    default:
      return null
  }
}

export function SignUpView({
  stepName = defaultStepName,
  stepTitle = defaultStepTitle,

  links,
  fields,
  extraFields,

  onSignUp,
  onBack,
}: SignUpViewProps) {
  const [_credentials, setCredentials] =
    useState<null | SignUpAccountFormOutput>(null)
  const [step, setStep] = useState<1 | 2>(1)

  const [extraFieldsEntries, setExtraFieldsEntries] = useState(
    extraFields != null ? Object.entries(extraFields) : [],
  )

  const hasExtraFields = extraFieldsEntries.length > 0
  const stepCount = hasExtraFields ? 2 : 1

  const doSubmitAccount = useCallback(
    (credentials: SignUpAccountFormOutput) => {
      setCredentials(credentials)
      if (hasExtraFields) {
        setStep(2)
      } else {
        onSignUp(credentials)
      }
    },
    [hasExtraFields, onSignUp, setCredentials, setStep],
  )

  useEffect(() => {
    let ef = extraFieldsEntries
    for (const entry of extraFields != null
      ? Object.entries(extraFields)
      : []) {
      ef = upsert(ef || [], entry, (a) => a[0] === entry[0])
    }
    if (ef !== extraFieldsEntries) setExtraFieldsEntries(ef)
  }, [extraFields])

  return (
    <LayoutTitlePage
      title="Create Account"
      subtitle="We're so excited to have you join us!"
    >
      <div className="max-w-lg w-full flex flex-col">
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
            usernameLabel={fields?.username?.label}
            usernamePlaceholder={fields?.username?.placeholder}
            usernamePattern={fields?.username?.pattern}
            usernameTitle={fields?.username?.title}
            passwordLabel={fields?.password?.label}
            passwordPlaceholder={fields?.password?.placeholder}
            passwordPattern={fields?.password?.pattern}
            passwordTitle={fields?.password?.title}
          >
            <SignUpDisclaimer links={links} />
          </SignUpAccountForm>
        )}

        {step === 2 && (
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-slate-700 bg-slate-100 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
            onClick={() => setStep(1)}
          >
            Back
          </button>
        )}

        <HelpCard className="mb-4" links={links} />
      </div>
    </LayoutTitlePage>
  )
}
