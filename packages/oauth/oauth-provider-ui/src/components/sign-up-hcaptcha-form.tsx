import HCaptcha from '@hcaptcha/react-hcaptcha'
import { Trans } from '@lingui/react/macro'
import { CheckIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
import { useBrowserColorScheme } from '#/hooks/use-browser-color-scheme.ts'
import { useStableCallback } from '#/hooks/use-stable-callback.ts'
import { schemaResolver } from '#/lib/form-resolver.ts'
import { useCurrentLocale } from '#/locales/locale-provider.tsx'

export type VerifyData = {
  token: string
  ekey: string
}

export type SignUpHcaptchaData = {
  verify: VerifyData
}

const hcaptchaSchema = z.object({
  verify: z.object({ token: z.string().min(1), ekey: z.string() }),
})

type HcaptchaValues = z.infer<typeof hcaptchaSchema>

export type SignUpHcaptchaFormProps = Omit<
  FormShellProps<HcaptchaValues>,
  'form' | 'onSubmit'
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

  const form = useForm<HcaptchaValues>({
    resolver: schemaResolver(hcaptchaSchema),
    reValidateMode: 'onChange',
    defaultValues: {
      verify: values?.verify ?? { token: '', ekey: '' },
    },
  })

  // @NOTE Mirror every keystroke back to the wizard, not just the submitted
  // values, so stepping Back and Forward again restores un-submitted input.
  const report = useStableCallback((next: unknown) => {
    onValues?.(next as Partial<SignUpHcaptchaData>)
  })
  useEffect(() => {
    const sub = form.watch((next) => report(next))
    return () => sub.unsubscribe()
  }, [form, report])

  return (
    <FormShell
      {...props}
      form={form}
      onSubmit={(next, signal) => {
        onValues?.({ verify: next.verify })
        return handler({ verify: next.verify }, signal)
      }}
    >
      {verifiedOnMount ? (
        <div className="flex flex-row items-center justify-start gap-2">
          <CheckIcon className="size-8 text-emerald-600 dark:text-emerald-400" />
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
            form.setValue('verify', { token, ekey }, { shouldValidate: true })
          }}
        />
      )}

      {children}
    </FormShell>
  )
}
