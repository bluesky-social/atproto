import type { ServerResponse } from 'node:http'
import {
  OAuthAuthorizationRequestParameters,
  OAuthResponseMode,
} from '@atproto/oauth-types'
import { AuthorizationError } from '../errors/authorization-error.js'
import { html, js } from '../lib/html/index.js'
import { sendWebPage } from '../lib/send-web-page.js'
import { AuthorizationRedirectParameters } from '../result/authorization-redirect-parameters.js'

// https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-11#section-7.5.4
const REDIRECT_STATUS_CODE = 303

export const SUCCESS_REDIRECT_KEYS = [
  'code',
  'id_token',
  'access_token',
  'expires_in',
  'token_type',
] as const

export const ERROR_REDIRECT_KEYS = [
  'error',
  'error_description',
  'error_uri',
] as const

export type OAuthRedirectQueryParameter =
  | 'iss'
  | 'state'
  | (typeof SUCCESS_REDIRECT_KEYS)[number]
  | (typeof ERROR_REDIRECT_KEYS)[number]

export function buildRedirectUri(
  parameters: OAuthAuthorizationRequestParameters,
): string {
  const uri = parameters.redirect_uri
  if (uri) return uri

  throw new AuthorizationError(parameters, 'No redirect_uri', 'invalid_request')
}

export function buildRedirectMode(
  parameters: OAuthAuthorizationRequestParameters,
): OAuthResponseMode {
  const mode = parameters.response_mode || 'query' // @TODO default should depend on response_type
  return mode
}

export function buildRedirectParams(
  issuer: string,
  parameters: OAuthAuthorizationRequestParameters,
  redirect: AuthorizationRedirectParameters,
): [OAuthRedirectQueryParameter, string][] {
  const params: [OAuthRedirectQueryParameter, string][] = [
    ['iss', issuer], // rfc9207
  ]

  if (parameters.state != null) {
    params.push(['state', parameters.state])
  }

  const keys = 'code' in redirect ? SUCCESS_REDIRECT_KEYS : ERROR_REDIRECT_KEYS
  for (const key of keys) {
    const value = redirect[key]
    if (value != null) params.push([key, value])
  }

  return params
}

export type OAuthRedirectOptions = {
  mode: OAuthResponseMode
  redirectUri: string
  params: Iterable<[string, string]>
}

export function sendRedirect(
  res: ServerResponse,
  { mode, redirectUri: uri, params }: OAuthRedirectOptions,
): void {
  res.setHeader('Cache-Control', 'no-store')

  switch (mode) {
    case 'query':
      return writeQuery(res, uri, params)
    case 'fragment':
      return writeFragment(res, uri, params)
    case 'form_post':
      return writeFormPost(res, uri, params)
  }

  // @ts-expect-error fool proof
  throw new Error(`Unsupported mode: ${mode}`)
}

function writeQuery(
  res: ServerResponse,
  uri: string,
  params: Iterable<[string, string]>,
): void {
  const url = new URL(uri)
  for (const [key, value] of params) url.searchParams.set(key, value)
  res.writeHead(REDIRECT_STATUS_CODE, { Location: url.href }).end()
}

function writeFragment(
  res: ServerResponse,
  uri: string,
  params: Iterable<[string, string]>,
): void {
  const url = new URL(uri)
  const searchParams = new URLSearchParams()
  for (const [key, value] of params) searchParams.set(key, value)
  url.hash = searchParams.toString()
  res.writeHead(REDIRECT_STATUS_CODE, { Location: url.href }).end()
}

function writeFormPost(
  res: ServerResponse,
  uri: string,
  params: Iterable<[string, string]>,
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
        ${Array.from(params, ([key, value]) => [
          html`<input type="hidden" name="${key}" value="${value}" />`,
        ])}
        <input type="submit" value="Continue" />
      </form>
    `,
    scripts: [js`document.forms[0].submit();`],
  })
}
