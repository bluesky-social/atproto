import HCaptcha from '@hcaptcha/react-hcaptcha'
import { ForwardedRef, useCallback, useRef, useState } from 'react'
import {
  FormCardAsync,
  FormCardAsyncProps,
} from '../../../components/forms/form-card-async'
import { mergeRefs } from '../../../lib/ref'
import { Override } from '../../../lib/util'

export type SignUpHcaptchaFormProps = Override<
  Omit<
    FormCardAsyncProps,
    'append' | 'onSubmit' | 'submitLabel' | 'onCancel' | 'cancelLabel'
  >,
  {
    siteKey: string

    token?: string
    onToken: (token: string, ekey: string) => void

    prevLabel?: string
    onPrev?: () => void

    nextLabel?: string
    onNext: (signal: AbortSignal) => void | PromiseLike<void>

    ref?: ForwardedRef<HCaptcha>
  }
>

export function SignUpHcaptchaForm({
  siteKey,

  token: tokenInit,
  onToken,

  prevLabel,
  onPrev,

  nextLabel,
  onNext,

  ref,

  // FormCardProps
  invalid,
  children,
  ...props
}: SignUpHcaptchaFormProps) {
  const captchaRef = useRef<HCaptcha>(null)
  const [token, setToken] = useState<string | undefined>(tokenInit)

  const onLoad = useCallback(() => {
    // this reaches out to the hCaptcha JS API and runs the
    // execute function on it. you can use other functions as
    // documented here:
    // https://docs.hcaptcha.com/configuration#jsapi
    captchaRef.current?.execute()
  }, [])

  const onVerify = useCallback(
    (token: string, ekey: string) => {
      setToken(token)
      onToken(token, ekey)
    },
    [onToken],
  )

  const doSubmit = useCallback(
    (signal: AbortSignal) => {
      if (token) return onNext(signal)
      else if (captchaRef.current) captchaRef.current.execute()
      else throw new Error('Unable to load hCaptcha')
    },
    [token, onNext],
  )

  return (
    <FormCardAsync
      {...props}
      cancelLabel={prevLabel}
      onCancel={onPrev}
      submitLabel={nextLabel}
      onSubmit={doSubmit}
      append={children}
      invalid={invalid || !token}
    >
      <HCaptcha
        sitekey={siteKey}
        onLoad={onLoad}
        onVerify={onVerify}
        ref={mergeRefs([ref, captchaRef])}
      />
    </FormCardAsync>
  )
}
