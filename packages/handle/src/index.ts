import * as address from '@sideway/address'
import { reservedSubdomains } from './reserved'

export const ensureValid = (
  handle: string,
  availableUserDomains: string[],
): void => {
  if (handle.startsWith('did:')) {
    throw new InvalidHandleError(
      'Cannot register a handle that starts with `did:`',
    )
  }
  const supportedDomain = availableUserDomains.find((domain) =>
    handle.endsWith(domain),
  )
  if (!supportedDomain) {
    throw new InvalidHandleError('Not a supported handle domain')
  }
  const front = handle.slice(0, handle.length - supportedDomain.length)
  if (front.length < 2) {
    throw new InvalidHandleError('Handle too short')
  } else if (front.length > 20) {
    throw new InvalidHandleError('Handle too long')
  }

  if (reservedSubdomains[front]) {
    throw new InvalidHandleError('Reserved handle')
  }

  if (front.indexOf('.') > -1) {
    throw new InvalidHandleError('Invalid characters in handle')
  }

  const isValid = address.isDomainValid(handle)
  if (!isValid) {
    throw new InvalidHandleError('Invalid characters in handle')
  }
}

export const normalize = (handle: string): string => {
  return handle.toLowerCase()
}

export const normalizeAndEnsureValid = (
  handle: string,
  availableUserDomains: string[],
): string => {
  const normalized = normalize(handle)
  ensureValid(normalized, availableUserDomains)
  return normalized
}

export const isValid = (
  handle: string,
  availableUserDomains: string[],
): boolean => {
  try {
    ensureValid(handle, availableUserDomains)
  } catch (err) {
    if (err instanceof InvalidHandleError) {
      return false
    }
    throw err
  }
  return true
}

export class InvalidHandleError extends Error {}
