import HCaptcha from '@hcaptcha/react-hcaptcha'
import { Trans } from '@lingui/react/macro'
import { CheckIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
import { useBrowserColorScheme } from '#/hooks/use-browser-color-scheme.ts'
import { useCurrentLocale } from '#/locales/locale-provider.tsx'

export type VerifyData = {
  token: string
  ekey: string
}

export type SignUpHcaptchaData = {
  verify: VerifyData
}

type HcaptchaValues = Record<string, never>

export type SignUpHcaptchaFormProps = Omit<
  FormShellProps<HcaptchaValues>,
  'onSubmit'
> & {
  siteKey: string
  values?: Partial<SignUpHcaptchaData>
  onValues?: (values: Partial<SignUpHcaptchaData>) => void
  handler: (
    data: SignUpHcaptchaData,
    signal: AbortSignal,
  ) => void | PromiseLike<void>
}

export function SignUpHcaptchaForm({
  siteKey,
  values,
  onValues,
  handler,
  children,
  ...props
}: SignUpHcaptchaFormProps) {
  const captchaRef = useRef<HCaptcha>(null)
  const theme = useBrowserColorScheme()
  const locale = useCurrentLocale()

  const [verifiedOnMount] = useState(values?.verify != null)

  // @NOTE The captcha result is not a form control, so it is held here and
  // mirrored to the wizard as it arrives rather than read off the element.
  const [verify, setVerify] = useState<VerifyData | null>(
    values?.verify ?? null,
  )

  return (
    <FormShell<HcaptchaValues>
      {...props}
      submittable={verify != null}
      onSubmit={(_next, signal) => {
        if (!verify) return
        onValues?.({ verify })
        return handler({ verify }, signal)
      }}
    >
      {verifiedOnMount ? (
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
            setVerify({ token, ekey })
          }}
        />
      )}

      {children}
    </FormShell>
  )
}
