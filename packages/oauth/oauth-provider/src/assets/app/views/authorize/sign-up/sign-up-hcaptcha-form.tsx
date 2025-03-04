import HCaptcha from '@hcaptcha/react-hcaptcha'
import { ForwardedRef, ReactNode, useCallback, useRef, useState } from 'react'
import {
  FormCardAsync,
  FormCardAsyncProps,
} from '../../../components/forms/form-card-async.tsx'
import { useBrowserColorScheme } from '../../../hooks/use-browser-color-scheme.ts'
import { mergeRefs } from '../../../lib/ref.ts'
import { Override } from '../../../lib/util.ts'

export type SignUpHcaptchaFormProps = Override<
  Omit<
    FormCardAsyncProps,
    'append' | 'onSubmit' | 'submitLabel' | 'onCancel' | 'cancelLabel'
  >,
  {
    siteKey: string

    token?: string
    onToken: (token: string, ekey: string) => void

    prevLabel?: ReactNode
    onPrev?: () => void

    nextLabel?: ReactNode
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
  const theme = useBrowserColorScheme()
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
        theme={theme}
        sitekey={siteKey}
        onLoad={onLoad}
        onVerify={onVerify}
        ref={mergeRefs([ref, captchaRef])}
      />
    </FormCardAsync>
  )
}
