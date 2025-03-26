import type { IncomingMessage, ServerResponse } from 'node:http'
import { InvalidRequestError } from '../../errors/invalid-request-error.js'
import { html, js } from '../../lib/html/index.js'
import { sendWebPage } from '../../lib/send-web-page.js'
import { AuthorizationResultRedirect } from '../../result/authorization-result-redirect.js'

// https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-11#section-7.5.4
const REDIRECT_STATUS_CODE = 303

const SUCCESS_REDIRECT_KEYS = [
  'code',
  'id_token',
  'access_token',
  'expires_in',
  'token_type',
] as const

const ERROR_REDIRECT_KEYS = ['error', 'error_description', 'error_uri'] as const

export function sendAuthorizeRedirect(
  req: IncomingMessage,
  res: ServerResponse,
  result: AuthorizationResultRedirect,
): void {
  const { issuer, parameters, redirect } = result

  const uri = parameters.redirect_uri
  if (!uri) throw new InvalidRequestError('No redirect_uri')

  const mode = parameters.response_mode || 'query' // @TODO: default should depend on response_type

  const entries: [string, string][] = [
    ['iss', issuer], // rfc9207
  ]

  if (parameters.state != null) {
    entries.push(['state', parameters.state])
  }

  const keys = 'code' in redirect ? SUCCESS_REDIRECT_KEYS : ERROR_REDIRECT_KEYS
  for (const key of keys) {
    const value = redirect[key]
    if (value != null) entries.push([key, value])
  }

  res.setHeader('Cache-Control', 'no-store')

  switch (mode) {
    case 'query':
      return writeQuery(res, uri, entries)
    case 'fragment':
      return writeFragment(res, uri, entries)
    case 'form_post':
      return writeFormPost(res, uri, entries)
  }

  // @ts-expect-error fool proof
  throw new Error(`Unsupported mode: ${mode}`)
}

function writeQuery(
  res: ServerResponse,
  uri: string,
  entries: readonly [string, string][],
): void {
  const url = new URL(uri)
  for (const [key, value] of entries) url.searchParams.set(key, value)
  res.writeHead(REDIRECT_STATUS_CODE, { Location: url.href }).end()
}

function writeFragment(
  res: ServerResponse,
  uri: string,
  entries: readonly [string, string][],
): void {
  const url = new URL(uri)
  const searchParams = new URLSearchParams()
  for (const [key, value] of entries) searchParams.set(key, value)
  url.hash = searchParams.toString()
  res.writeHead(REDIRECT_STATUS_CODE, { Location: url.href }).end()
}

function writeFormPost(
  res: ServerResponse,
  uri: string,
  entries: readonly [string, string][],
): void {
  // Prevent the Chrome from caching this page
  // see: https://latesthackingnews.com/2023/12/12/google-updates-chrome-bfcache-for-faster-page-viewing/
  res.setHeader('Set-Cookie', `bfCacheBypass=foo; max-age=1; SameSite=Lax`)
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Permissions-Policy', 'otp-credentials=*, document-domain=()')

  return sendWebPage(res, {
    htmlAttrs: { lang: 'en' },
    body: html`
      <form method="post" action="${uri}">
        ${entries.map(([key, value]) => [
          html`<input type="hidden" name="${key}" value="${value}" />`,
        ])}
        <input type="submit" value="Continue" />
      </form>
    `,
    scripts: [js`document.forms[0].submit();`],
  })
}
