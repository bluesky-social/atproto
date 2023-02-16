import * as address from '@sideway/address'
import { reservedSubdomains } from './reserved'

export * from './resolve'

export const ensureValid = (handle: string): void => {
  if (handle.startsWith('did:')) {
    throw new InvalidHandleError(
      'Cannot register a handle that starts with `did:`',
    )
  }

  if (handle.length > 40) {
    throw new InvalidHandleError('Handle too long')
  }

  handle.split('.').map((domainLabel) => {
    if (domainLabel.length > 20) {
      throw new InvalidHandleError('Handle too long')
    }
  })

  const isValid = address.isDomainValid(handle)
  if (!isValid) {
    throw new InvalidHandleError('Invalid characters in handle')
  }

  // check that all chars are boring ASCII
  if (!/^[a-zA-Z0-9.-]+$/.test(handle)) {
    throw new InvalidHandleError('Invalid characters in handle')
  }
}

export const normalize = (handle: string): string => {
  return handle.toLowerCase()
}

export const normalizeAndEnsureValid = (handle: string): string => {
  const normalized = normalize(handle)
  ensureValid(normalized)
  return normalized
}

export const isValid = (handle: string): boolean => {
  try {
    ensureValid(handle)
  } catch (err) {
    if (err instanceof InvalidHandleError) {
      return false
    }
    throw err
  }
  return true
}

export const ensureServiceConstraints = (
  handle: string,
  availableUserDomains: string[],
  reserved = reservedSubdomains,
): void => {
  const supportedDomain = availableUserDomains.find((domain) =>
    handle.endsWith(domain),
  )
  if (!supportedDomain) {
    throw new UnsupportedDomainError('Not a supported handle domain')
  }
  const front = handle.slice(0, handle.length - supportedDomain.length)
  if (front.indexOf('.') > -1) {
    throw new InvalidHandleError('Invalid characters in handle')
  }
  if (front.length < 3) {
    throw new InvalidHandleError('Handle too short')
  }
  if (reserved[front]) {
    throw new ReservedHandleError('Reserved handle')
  }
}

export const fulfillsServiceConstraints = (
  handle: string,
  availableUserDomains: string[],
  reserved = reservedSubdomains,
): boolean => {
  try {
    ensureServiceConstraints(handle, availableUserDomains, reserved)
  } catch (err) {
    if (
      err instanceof InvalidHandleError ||
      err instanceof ReservedHandleError ||
      err instanceof UnsupportedDomainError
    ) {
      return false
    }
    throw err
  }
  return true
}

export class InvalidHandleError extends Error {}
export class ReservedHandleError extends Error {}
export class UnsupportedDomainError extends Error {}
