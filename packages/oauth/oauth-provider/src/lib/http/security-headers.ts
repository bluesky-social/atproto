import type { ServerResponse } from 'node:http'
import { type CspConfig, buildCsp } from '../csp/index.js'

/**
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Embedder-Policy COEP on MDN}
 */
export enum CrossOriginEmbedderPolicy {
  unsafeNone = 'unsafe-none',
  requireCorp = 'require-corp',
  credentialless = 'credentialless',
}

/**
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Resource-Policy CORP on MDN}
 */
export enum CrossOriginResourcePolicy {
  sameSite = 'same-site',
  sameOrigin = 'same-origin',
  crossOrigin = 'cross-origin',
}

/**
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy COOP on MDN}
 */
export enum CrossOriginOpenerPolicy {
  unsafeNone = 'unsafe-none',
  sameOriginAllowPopups = 'same-origin-allow-popups',
  sameOrigin = 'same-origin',
  noopenerAllowPopups = 'noopener-allow-popups',
}

export type HTTPStrictTransportSecurityConfig = {
  maxAge: number
  includeSubDomains?: boolean
  preload?: boolean
}

export type SecurityHeadersOptions = {
  /**
   * Defaults to `default-src: 'none'`. Use an empty object to disable CSP.
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy CSP on MDN}
   */
  csp?: CspConfig
  coep?: CrossOriginEmbedderPolicy
  corp?: CrossOriginResourcePolicy
  coop?: CrossOriginOpenerPolicy
  /**
   * Defaults to 2 years. Use `false` to disable HSTS.
   */
  hsts?: HTTPStrictTransportSecurityConfig | false
}

export function setSecurityHeaders(
  res: ServerResponse,
  {
    csp = { 'default-src': ["'none'"] },
    coep = CrossOriginEmbedderPolicy.requireCorp,
    corp = CrossOriginResourcePolicy.sameOrigin,
    coop = CrossOriginOpenerPolicy.sameOrigin,
    hsts = { maxAge: 63072000 },
  }: SecurityHeadersOptions,
): void {
  // @NOTE Never set CSP through http-equiv meta as not all directives will
  // be honored. Always set it through the Content-Security-Policy header.
  const cspString = buildCsp(csp)
  if (cspString) {
    res.setHeader('Content-Security-Policy', cspString)
  }

  res.setHeader('Cross-Origin-Embedder-Policy', coep)
  res.setHeader('Cross-Origin-Resource-Policy', corp)
  res.setHeader('Cross-Origin-Opener-Policy', coop)

  if (hsts) {
    res.setHeader('Strict-Transport-Security', buildHstsValue(hsts))
  }

  // @TODO make these headers configurable (?)
  res.setHeader('Permissions-Policy', 'otp-credentials=*, document-domain=()')
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-XSS-Protection', '0')
}

function buildHstsValue(config: HTTPStrictTransportSecurityConfig): string {
  let value = `max-age=${config.maxAge}`
  if (config.includeSubDomains) value += '; includeSubDomains'
  if (config.preload) value += '; preload'
  return value
}
