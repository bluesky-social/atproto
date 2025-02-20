import { useEffect, useMemo, useRef, useState } from 'react'
import { Fieldset } from '../../../components/forms/fieldset'
import {
  AsyncActionController,
  FormCardAsync,
  FormCardAsyncProps,
} from '../../../components/forms/form-card-async'
import { InputEmailAddress } from '../../../components/forms/input-email-address'
import { InputNewPassword } from '../../../components/forms/input-new-password'
import { InputText } from '../../../components/forms/input-text'
import { InputToken } from '../../../components/forms/input-token'
import { CalendarIcon } from '../../../components/utils/icons'
import { mergeRefs } from '../../../lib/ref'
import { Override } from '../../../lib/util'

export type SignUpAccountFormOutput = {
  email: string
  password: string
  birthdate: string
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
    nextLabel?: string

    onPrev?: () => void
    prevLabel?: string
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
  const [email, setEmail] = useState(creds?.email)
  const [password, setPassword] = useState(creds?.password)
  const [birthdate, setBirthdate] = useState(creds?.birthdate)
  const [inviteCode, setInviteCode] = useState(creds?.inviteCode)

  const formRef = useRef<AsyncActionController>(null)
  const resetForm = () => formRef.current?.reset()

  const credentials = useMemo(
    () =>
      email && password && birthdate && (!inviteCodeRequired || inviteCode)
        ? {
            email,
            password,
            birthdate,
            inviteCode: inviteCodeRequired ? inviteCode : undefined,
          }
        : undefined,
    [email, password, birthdate, inviteCode, inviteCodeRequired],
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
        <Fieldset label="Invite code">
          <InputToken
            name="inviteCode"
            aria-label="Invite code"
            title="Invite code"
            required
            value={inviteCode}
            onChange={(event) => {
              setInviteCode(event.target.value)
              resetForm()
            }}
            enterKeyHint="next"
          />
        </Fieldset>
      )}

      <Fieldset label="Email">
        <InputEmailAddress
          name="email"
          enterKeyHint="next"
          required
          defaultValue={email}
          onEmail={(email) => {
            setEmail(email)
            resetForm()
          }}
        />
      </Fieldset>

      <Fieldset label="Password">
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
      </Fieldset>

      <Fieldset label="Birthdate">
        <InputText
          icon={<CalendarIcon className="w-5" />}
          name="birthdate"
          type="date"
          aria-label="Birthdate"
          title="Birthdate"
          autoComplete="bday"
          dir="auto"
          enterKeyHint="done"
          required
          min="1908-06-08"
          max={new Date().toISOString().split('T')[0]}
          defaultValue={birthdate}
          onChange={(event) => {
            setBirthdate(event.target.value)
            resetForm()
          }}
        />
      </Fieldset>
    </FormCardAsync>
  )
}
