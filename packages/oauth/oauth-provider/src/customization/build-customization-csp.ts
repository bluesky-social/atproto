import {
  type CspConfig,
  type CspValue,
  dataUriToSha256,
  mergeCsp,
} from '../lib/csp/index.js'
import type { Customization } from './customization.js'

/**
 * @see {@link https://docs.hcaptcha.com/#content-security-policy-settings}
 */
const HCAPTCHA_CSP: CspConfig = {
  'script-src': ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
  'frame-src': ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
  'style-src': ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
  'connect-src': ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
}

export function buildCustomizationCsp({
  branding,
  hcaptcha,
}: Customization): CspConfig | undefined {
  let customizationCsp: CspConfig | undefined = undefined

  // Extract customization images
  {
    const imgSrc = new Set<CspValue>()

    for (const uri of [
      branding?.logo,
      branding?.background?.dark,
      branding?.background?.light,
    ]) {
      if (uri != null) {
        if (isHttpUri(uri)) {
          imgSrc.add(uri)
        } else if (isDataUri(uri)) {
          imgSrc.add(dataUriToSha256(uri))
        } else {
          throw new Error(`Unsupported URI format: ${uri}`)
        }
      }
    }

    if (imgSrc.size > 0) {
      customizationCsp = mergeCsp(customizationCsp, { 'img-src': imgSrc })
    }
  }

  // Merge hCaptcha CSP if used
  if (hcaptcha) {
    customizationCsp = mergeCsp(customizationCsp, HCAPTCHA_CSP)
  }

  return customizationCsp
}

function isHttpUri(
  uri: string,
): uri is `http://${string}` | `https://${string}` {
  return uri.startsWith('http://') || uri.startsWith('https://')
}

function isDataUri(uri: string): uri is `data:${string}` {
  return uri.startsWith('data:')
}
