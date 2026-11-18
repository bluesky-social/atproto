import { Trans } from '@lingui/react/macro'
import { CheckIcon } from 'lucide-react'
import { useState } from 'react'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
import { HcaptchaChallenge } from '#/components/hcaptcha-challenge.tsx'
import type { Override } from '#/lib/util'

export type VerifyData = {
  token: string
  ekey: string
}

export type SignUpHcaptchaData = {
  verify: VerifyData
}

export type SignUpHcaptchaFormProps = Override<
  FormShellProps<SignUpHcaptchaData>,
  {
    siteKey: string
    defaultValues?: Partial<SignUpHcaptchaData>
  }
>

export function SignUpHcaptchaForm({
  siteKey,
  defaultValues,
  onValues,
  handler,
  children,
  ...props
}: SignUpHcaptchaFormProps) {
  const [verifiedOnMount] = useState(defaultValues?.verify != null)

  // @NOTE The captcha result is not a form control, so it is held here and
  // mirrored to the wizard as it arrives rather than read off the element.
  const [verify, setVerify] = useState<VerifyData | undefined>(
    defaultValues?.verify,
  )

  return (
    <FormShell
      {...props}
      submittable={verify != null}
      onValues={(_values) => onValues?.({ verify })}
      handler={(_values, signal) => {
        // Fool-proofing (should be ensured by "submittable" prop)
        if (!verify) throw new Error('Verification required')
        return handler({ verify }, signal)
      }}
    >
      {verifiedOnMount ? (
        <div className="flex flex-row items-center justify-start gap-2">
          <CheckIcon className="text-success size-8" />
          <Trans>Verification successful!</Trans>
        </div>
      ) : (
        <HcaptchaChallenge
          siteKey={siteKey}
          onVerify={(token, ekey) => {
            setVerify({ token, ekey })
            onValues?.({ verify: { token, ekey } })
          }}
        />
      )}

      {children}
    </FormShell>
  )
}
