import { Trans, useLingui } from '@lingui/react/macro'
import { NumpadIcon } from '@phosphor-icons/react'
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  AsyncActionController,
  FormCardAsync,
  FormCardAsyncProps,
} from '#/components/forms/form-card-async.tsx'
import { FormField } from '#/components/forms/form-field'
import { InputEmailAddress } from '#/components/forms/input-email-address.tsx'
import { InputNewPassword } from '#/components/forms/input-new-password.tsx'
import { InputText } from '#/components/forms/input-text.tsx'
import { mergeRefs } from '#/lib/ref.ts'
import { Override } from '#/lib/util.ts'

export type SignUpAccountFormOutput = {
  email: string
  password: string
  inviteCode?: string
}

export type SignUpAccountFormProps = Override<
  Omit<
    FormCardAsyncProps,
    'append' | 'onCancel' | 'onSubmit' | 'submitLabel' | 'cancelLabel'
  >,
  {
    inviteCodeRequired?: boolean

    credentials?: SignUpAccountFormOutput
    onCredentials?: (credentials?: SignUpAccountFormOutput) => void

    onNext: (signal: AbortSignal) => void | PromiseLike<void>
    nextLabel?: ReactNode

    onPrev?: () => void
    prevLabel?: ReactNode
  }
>

export function SignUpAccountForm({
  inviteCodeRequired = true,

  credentials: creds,
  onCredentials,

  onNext,
  nextLabel,

  onPrev,
  prevLabel,

  // FormCardAsyncProps
  children,
  ref,
  invalid,
  ...props
}: SignUpAccountFormProps) {
  const { t } = useLingui()

  const [email, setEmail] = useState(creds?.email)
  const [password, setPassword] = useState(creds?.password)
  const [inviteCode, setInviteCode] = useState(creds?.inviteCode)

  const formRef = useRef<AsyncActionController>(null)
  const resetForm = () => formRef.current?.reset()

  const credentials = useMemo(
    () =>
      email && password && (!inviteCodeRequired || inviteCode)
        ? {
            email,
            password,
            inviteCode: inviteCodeRequired ? inviteCode : undefined,
          }
        : undefined,
    [email, password, inviteCode, inviteCodeRequired],
  )

  useEffect(() => {
    onCredentials?.(credentials)
  }, [credentials, onCredentials])

  return (
    <FormCardAsync
      {...props}
      ref={mergeRefs([ref, formRef])}
      invalid={invalid || !credentials}
      onCancel={onPrev}
      cancelLabel={prevLabel}
      onSubmit={onNext}
      submitLabel={nextLabel}
      append={children}
    >
      {inviteCodeRequired && (
        <FormField label={<Trans>Invite code</Trans>}>
          <InputText
            icon={<NumpadIcon className="w-5" />}
            autoFocus
            name="inviteCode"
            title={t`Invite code`}
            placeholder={t`example-com-xxxxx-xxxxx`}
            required
            value={inviteCode || ''}
            onChange={(event) => {
              setInviteCode(event.target.value || undefined)
              resetForm()
            }}
            enterKeyHint="next"
          />
        </FormField>
      )}

      <FormField label={<Trans>Email</Trans>}>
        <InputEmailAddress
          autoFocus={!inviteCodeRequired}
          name="email"
          enterKeyHint="next"
          required
          defaultValue={email}
          onEmail={(email) => {
            setEmail(email)
            resetForm()
          }}
        />
      </FormField>

      <FormField label={<Trans>Password</Trans>}>
        <InputNewPassword
          name="password"
          enterKeyHint="next"
          required
          password={password}
          onPassword={(value) => {
            setPassword(value)
            resetForm()
          }}
        />
      </FormField>
    </FormCardAsync>
  )
}
