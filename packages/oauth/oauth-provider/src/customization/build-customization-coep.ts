import { CrossOriginEmbedderPolicy } from '../lib/http/security-headers.js'
import type { Customization } from './customization.js'

export function buildCustomizationCoep({
  hcaptcha,
}: Customization): CrossOriginEmbedderPolicy | undefined {
  // hCaptcha's implementation of COEP is currently broken. Let's disable it
  // to avoid breaking the entire page.
  //
  // https://github.com/hCaptcha/react-hcaptcha/issues/259
  // https://github.com/hCaptcha/react-hcaptcha/issues/380
  if (hcaptcha) return CrossOriginEmbedderPolicy.unsafeNone
}
