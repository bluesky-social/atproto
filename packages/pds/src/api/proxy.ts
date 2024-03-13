import { Readable } from 'node:stream'
import * as express from 'express'
import AtpAgent from '@atproto/api'
import { Headers, XRPCError } from '@atproto/xrpc'
import {
  AuthRequiredError,
  InvalidRequestError,
  UpstreamFailureError,
} from '@atproto/xrpc-server'
import AppContext from '../context'

export const proxy = async <T>(
  ctx: AppContext,
  pdsDid: string | null | undefined,
  fn: (agent: AtpAgent) => Promise<T>,
): Promise<T | null> => {
  if (isThisPds(ctx, pdsDid) || !ctx.cfg.service.isEntryway) {
    return null // skip proxying
  }
  const accountService = ctx.services.account(ctx.db)
  const pds = pdsDid && (await accountService.getPds(pdsDid, { cached: true }))
  if (!pds) {
    throw new UpstreamFailureError('unknown pds')
  }
  try {
    return await fn(ctx.pdsAgents.get(pds.host))
  } catch (err) {
    if (
      err instanceof XRPCError &&
      err.status === 403 &&
      err.error === 'AccountNotFound'
    ) {
      // instruct client to refresh token during potential account migration
      throw new InvalidRequestError(
        'Token audience is out of date',
        'ExpiredToken',
      )
    }
    throw err
  }
}

export const proxyAppView = async <T>(
  ctx: AppContext,
  fn: (agent: AtpAgent) => Promise<T>,
): Promise<T> => {
  try {
    return await fn(ctx.appViewAgent)
  } catch (err) {
    if (
      err instanceof XRPCError &&
      err.status === 401 &&
      err.error === 'BadJwtSignature'
    ) {
      // instruct client to refresh token during potential account migration
      throw new InvalidRequestError(
        'Service token issuer is out of date',
        'ExpiredToken',
      )
    }
    throw err
  }
}

export const getStreamingRequestInit = (body: Readable): RequestInit => {
  const reqInit: RequestInit & { duplex: string } = {
    body: Readable.toWeb(body),
    duplex: 'half',
  }
  return reqInit
}

export const isThisPds = (
  ctx: AppContext,
  pdsDid: string | null | undefined,
) => {
  return !pdsDid || pdsDid === ctx.cfg.service.did
}

// @NOTE on the identity service this serves a 400 w/ ExpiredToken to prompt a refresh flow from the client.
// the analogous case on our non-entryway PDSes would be a 403 w/ AccountNotFound when the user can auth but doesn't have an account.
export const ensureThisPds = (ctx: AppContext, pdsDid: string | null) => {
  if (!isThisPds(ctx, pdsDid)) {
    if (ctx.cfg.service.isEntryway) {
      // instruct client to refresh token during potential account migration
      throw new InvalidRequestError(
        'Token audience is out of date',
        'ExpiredToken',
      )
    } else {
      // this shouldn't really happen, since we validate the token's audience on our non-entryway PDSes.
      throw new AuthRequiredError('Bad token audience')
    }
  }
}

export const resultPassthru = <T>(result: { headers: Headers; data: T }) => {
  // @TODO pass through any headers that we always want to forward along
  return {
    encoding: 'application/json' as const,
    body: result.data,
  }
}

// Output designed to passed as second arg to AtpAgent methods.
// The encoding field here is a quirk of the AtpAgent.
export function authPassthru(
  req: express.Request,
  withEncoding?: false,
): { headers: Record<string, string>; encoding: undefined } | undefined

export function authPassthru(
  req: express.Request,
  withEncoding: true,
): { headers: Record<string, string>; encoding: 'application/json' } | undefined

export function authPassthru(req: express.Request, withEncoding?: boolean) {
  const headers: Record<string, string> = {}
  if (req.headers.authorization) {
    headers.authorization = req.headers.authorization
    if (typeof req.headers['atproto-proxy'] === 'string') {
      headers['atproto-proxy'] = req.headers['atproto-proxy']
    }
  }
  if (typeof req.headers['atproto-accept-labelers'] === 'string') {
    headers['atproto-accept-labelers'] = req.headers['atproto-accept-labelers']
  }
  if (!Object.keys(headers).length) return
  return {
    headers,
    encoding: withEncoding ? 'application/json' : undefined,
  }
}
