import {
  InvalidHandleError,
  normalizeAndEnsureValidHandle,
} from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { reservedSubdomains } from './reserved'

export const baseNormalizeAndValidate = (handle: string) => {
  try {
    return normalizeAndEnsureValidHandle(handle)
  } catch (err) {
    if (err instanceof InvalidHandleError) {
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
  if (front.length > 18) {
    throw new InvalidRequestError('Handle too long', 'InvalidHandle')
  }
  if (!allowReserved && reservedSubdomains[front]) {
    throw new InvalidRequestError('Reserved handle', 'HandleNotAvailable')
  }
}
