import * as ident from '@atproto/identifier'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { reservedSubdomains } from './reserved'
import { hasExplicitSlur } from '../content-reporter/explicit-slurs'
import AppContext from '../context'

export const normalizeAndValidateHandle = async (opts: {
  ctx: AppContext
  handle: string
  did?: string
  allowReserved?: boolean
}): Promise<string> => {
  const { ctx, did, allowReserved } = opts
  // base formatting validation
  const handle = baseNormalizeAndValidate(opts.handle)
  // tld validation
  if (!ident.isValidTld) {
    throw new InvalidRequestError(
      'Handle TLD is invalid or disallowed',
      'InvalidHandle',
    )
  }
  // slur check
  if (hasExplicitSlur(handle)) {
    throw new InvalidRequestError(
      'Inappropriate language in handle',
      'InvalidHandle',
    )
  }
  if (isServiceDomain(handle, ctx.cfg.availableUserDomains)) {
    // verify constraints on a service domain
    ensureHandleServiceConstraints(
      handle,
      ctx.cfg.availableUserDomains,
      allowReserved,
    )
  } else {
    if (opts.did === undefined) {
      throw new InvalidRequestError(
        'Not a supported handle domain',
        'UnsupportedDomain',
      )
    }
    // verify resolution of a non-service domain
    const resolvedDid = await ctx.idResolver.handle.resolve(handle)
    if (resolvedDid !== did) {
      throw new InvalidRequestError('External handle did not resolve to DID')
    }
  }
  return handle
}

export const baseNormalizeAndValidate = (handle: string) => {
  try {
    const normalized = ident.normalizeAndEnsureValidHandle(handle)
    return normalized
  } catch (err) {
    if (err instanceof ident.InvalidHandleError) {
      throw new InvalidRequestError(err.message, 'InvalidHandle')
    }
    throw err
  }
}

export const isServiceDomain = (
  handle: string,
  availableUserDomains: string[],
): boolean => {
  return availableUserDomains.some((domain) => handle.endsWith(domain))
}

export const ensureHandleServiceConstraints = (
  handle: string,
  availableUserDomains: string[],
  allowReserved = false,
): void => {
  const supportedDomain =
    availableUserDomains.find((domain) => handle.endsWith(domain)) ?? ''
  const front = handle.slice(0, handle.length - supportedDomain.length)
  if (front.includes('.')) {
    throw new InvalidRequestError(
      'Invalid characters in handle',
      'InvalidHandle',
    )
  }
  if (front.length < 3) {
    throw new InvalidRequestError('Handle too short', 'InvalidHandle')
  }
  if (handle.length > 30) {
    throw new InvalidRequestError('Handle too long', 'InvalidHandle')
  }
  if (!allowReserved && reservedSubdomains[front]) {
    throw new InvalidRequestError('Reserved handle', 'HandleNotAvailable')
  }
}
