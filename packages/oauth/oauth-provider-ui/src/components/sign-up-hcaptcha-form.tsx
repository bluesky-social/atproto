import HCaptcha from '@hcaptcha/react-hcaptcha'
import { Trans } from '@lingui/react/macro'
import { CheckIcon } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { SmartForm, WrappedSmartFormProps } from '#/components/forms/smart-form'
import { useBrowserColorScheme } from '#/hooks/use-browser-color-scheme.ts'
import { useCurrentLocale } from '#/locales/locale-provider'

export type VerifyData = {
  token: string
  ekey: string
}

export type SignUpHcaptchaData = {
  verify: VerifyData
}

export type SignUpHcaptchaFormProps =
  WrappedSmartFormProps<SignUpHcaptchaData> & {
    siteKey: string
  }

export function SignUpHcaptchaForm({
  siteKey,
  ...props
}: SignUpHcaptchaFormProps) {
  const captchaRef = useRef<HCaptcha>(null)
  const theme = useBrowserColorScheme()
  const locale = useCurrentLocale()

  const [verifiedOnMount] = useState(props.values?.verify != null)

  return (
    <SmartForm
      {...props}
      validate={({ verify }) => {
        if (verify) return { verify }
      }}
      fields={({ set }) =>
        verifiedOnMount ? (
          <div className="flex flex-row items-center justify-start gap-2">
            <CheckIcon className="text-success size-8" />
            <Trans>Verification successful!</Trans>
          </div>
        ) : (
          <HCaptcha
            theme={theme}
            sitekey={siteKey}
            ref={captchaRef}
            languageOverride={locale}
            onLoad={() => {
              // this reaches out to the hCaptcha JS API and runs the
              // execute function on it. you can use other functions as
              // documented here:
              // https://docs.hcaptcha.com/configuration#jsapi
              captchaRef.current?.execute()
            }}
            onVerify={(token: string, ekey: string) => {
              set('verify', { token, ekey })
            }}
          />
        )
      }
    />
  )
}
