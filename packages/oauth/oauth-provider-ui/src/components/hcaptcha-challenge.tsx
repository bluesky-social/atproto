import type HCaptcha from '@hcaptcha/react-hcaptcha'
import {
  type ComponentPropsWithRef,
  type ComponentType,
  Suspense,
  lazy,
  useRef,
} from 'react'
import { useBrowserColorScheme } from '#/hooks/use-browser-color-scheme.ts'
import { useCurrentLocale } from '#/locales/locale-provider.tsx'

// @NOTE The component calls an "onReady" prop every time the widget is rendered
// (see its "renderCaptcha" method), which its type definitions omit.
type HCaptchaProps = ComponentPropsWithRef<typeof HCaptcha> & {
  onReady?: () => void
}

// @NOTE Loaded on demand, since most visitors never get to see a challenge.
const LazyHCaptcha = lazy<ComponentType<HCaptchaProps>>(
  () => import('@hcaptcha/react-hcaptcha'),
)

export type HcaptchaChallengeProps = {
  siteKey: string
  onVerify: (token: string, ekey: string) => void
  onExpire?: () => void
}

/**
 * The hCaptcha widget, executed as soon as it is rendered.
 */
export function HcaptchaChallenge({
  siteKey,
  onVerify,
  onExpire,
}: HcaptchaChallengeProps) {
  const captchaRef = useRef<HCaptcha>(null)
  const theme = useBrowserColorScheme()
  const locale = useCurrentLocale()

  return (
    <Suspense fallback={null}>
      <LazyHCaptcha
        theme={theme}
        sitekey={siteKey}
        ref={captchaRef}
        languageOverride={locale}
        // @NOTE "onReady" fires every time the widget is rendered, whereas
        // "onLoad" only fires when the hCaptcha script was first loaded (so not
        // for widgets mounted after the first one).
        onReady={() => {
          // this reaches out to the hCaptcha JS API and runs the
          // execute function on it. you can use other functions as
          // documented here:
          // https://docs.hcaptcha.com/configuration#jsapi
          captchaRef.current?.execute()
        }}
        onVerify={onVerify}
        onExpire={onExpire}
      />
    </Suspense>
  )
}
