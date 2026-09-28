import type { CspConfig } from '../lib/csp/index.js'
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

/**
 * Transforms the customization settings into a Content Security Policy (CSP)
 * configuration, based on the ways customization settings are used in the
 * @atproto/oauth-provider-ui web app.
 */
export function* buildCustomizationCsp({
  branding,
  hcaptcha,
}: Customization): Generator<CspConfig, void, unknown> {
  // branding related CSP
  if (branding) {
    for (const uri of [
      branding.logo,
      branding.background?.dark,
      branding.background?.light,
    ]) {
      if (uri != null) {
        if (isHttpUri(uri)) {
          yield { 'img-src': [uri] }
        } else if (isDataUri(uri)) {
          // CSP hash sources (e.g. `sha256-<hash>`) do not authorize image
          // fetches: they only apply to inline scripts/styles (and external
          // scripts carrying integrity metadata), never to an `img-src` URL
          // match. See the "Sources" note in:
          // https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/img-src
          // So the only way to allow a `data:` image is the `data:` scheme
          // source, which we add here exclusively when the customization
          // actually references a `data:` uri.
          yield { 'img-src': ['data:'] }
        } else {
          throw new Error(`Unsupported URI format: ${uri}`)
        }
      }
    }
  }

  // hCaptcha related CSP
  if (hcaptcha) {
    yield HCAPTCHA_CSP
  }
}

function isHttpUri(
  uri: string,
): uri is `http://${string}` | `https://${string}` {
  return uri.startsWith('http://') || uri.startsWith('https://')
}

function isDataUri(uri: string): uri is `data:${string}` {
  // Basic validation of data URIs
  return uri.startsWith('data:') && uri.length > 5 && uri.indexOf(',', 5) !== -1
}
