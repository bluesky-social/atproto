import type { ServerResponse } from 'node:http'
import {
  OAuthAuthorizationRequestParameters,
  OAuthResponseMode,
} from '@atproto/oauth-types'
import { AuthorizationError } from '../../errors/authorization-error.js'
import {
  WriteFormRedirectOptions,
  writeFormRedirect,
} from '../../lib/write-form-redirect.js'
import { AuthorizationRedirectParameters } from '../../result/authorization-redirect-parameters.js'
import { AuthorizationResultRedirect } from '../../result/authorization-result-redirect.js'

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

export function sendAuthorizationResultRedirect(
  res: ServerResponse,
  result: AuthorizationResultRedirect,
  options?: WriteFormRedirectOptions,
) {
  const { issuer, parameters, redirect } = result

  return sendRedirect(
    res,
    {
      redirectUri: buildRedirectUri(parameters),
      mode: buildRedirectMode(parameters),
      params: buildRedirectParams(issuer, parameters, redirect),
    },
    options,
  )
}

export type OAuthRedirectOptions = {
  mode: OAuthResponseMode
  redirectUri: string
  params: Iterable<[string, string]>
}

export function sendRedirect(
  res: ServerResponse,
  redirect: OAuthRedirectOptions,
  options?: WriteFormRedirectOptions,
): void {
  res.setHeader('Cache-Control', 'no-store')

  const { mode, redirectUri: uri, params } = redirect
  switch (mode) {
    case 'query':
      return writeQuery(res, uri, params)
    case 'fragment':
      return writeFragment(res, uri, params)
    case 'form_post':
      return writeFormRedirect(res, 'post', uri, params, options)
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
