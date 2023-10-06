import * as express from 'express'
import AtpAgent from '@atproto/api'
import { Headers, XRPCError } from '@atproto/xrpc'
import { InvalidRequestError, UpstreamFailureError } from '@atproto/xrpc-server'
import AppContext from '../context'

export const proxy = async <T>(
  ctx: AppContext,
  creds: { audience?: string },
  fn: (agent: AtpAgent) => Promise<T>,
): Promise<T | null> => {
  if (!creds.audience || creds.audience === ctx.cfg.service.did) {
    return null // credentials are for this pds, skip proxying
  }
  const accountService = ctx.services.account(ctx.db)
  const pds = await accountService.getPds(creds.audience)
  if (!pds) {
    throw new UpstreamFailureError('unknown pds in credentials')
  }
  // @TODO reuse agents
  const agent = new AtpAgent({ service: `https://${pds.host}` })
  try {
    return await fn(agent)
  } catch (err) {
    // @TODO may need to pass through special lexicon errors
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

export const proxyUnauthed = async <T>(
  ctx: AppContext,
  pdsDid: string | null,
  fn: (agent: AtpAgent) => Promise<T>,
): Promise<T | null> => {
  if (isThisPds(ctx, pdsDid)) {
    return null // credentials are for this pds, skip proxying
  }
  const accountService = ctx.services.account(ctx.db)
  const pds = pdsDid && (await accountService.getPds(pdsDid))
  if (!pds) {
    throw new UpstreamFailureError('unknown pds')
  }
  const agent = new AtpAgent({ service: `https://${pds.host}` })
  return fn(agent)
}

export const isThisPds = (ctx: AppContext, pdsDid: string | null) => {
  return !pdsDid || pdsDid === ctx.cfg.service.did
}

// @NOTE on the identity service this serves a 400 w/ ExpiredToken to prompt a refresh flow from the client.
// but on our other PDSes the same case should be a 403 w/ AccountNotFound, assuming their access token verifies.
export const ensureThisPds = (ctx: AppContext, pdsDid: string | null) => {
  if (!isThisPds(ctx, pdsDid)) {
    // instruct client to refresh token during potential account migration
    throw new InvalidRequestError(
      'Token audience is out of date',
      'ExpiredToken',
    )
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
): { headers: { authorization: string }; encoding: undefined } | undefined

export function authPassthru(
  req: express.Request,
  withEncoding: true,
):
  | { headers: { authorization: string }; encoding: 'application/json' }
  | undefined

export function authPassthru(req: express.Request, withEncoding?: boolean) {
  if (req.headers.authorization) {
    return {
      headers: { authorization: req.headers.authorization },
      encoding: withEncoding ? 'application/json' : undefined,
    }
  }
}
