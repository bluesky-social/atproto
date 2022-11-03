import { InvalidRequestError } from '@atproto/xrpc-server'
import * as address from '@sideway/address'
import { reservedSubdomains } from './handle-reserved'

export const ensureValidHandle = (
  handle: string,
  availableUserDomains: string[],
): void => {
  if (handle.startsWith('did:')) {
    throw new InvalidRequestError(
      'Cannot register a handle that starts with `did:`',
      'InvalidHandle',
    )
  }
  const supportedDomain = availableUserDomains.find((domain) =>
    handle.endsWith(domain),
  )
  if (!supportedDomain) {
    throw new InvalidRequestError(
      'Not a supported handle domain',
      'InvalidHandle',
    )
  }
  const front = handle.slice(0, handle.length - supportedDomain.length)
  if (front.length < 2) {
    throw new InvalidRequestError('Handle too short', 'InvalidHandle')
  } else if (front.length > 20) {
    throw new InvalidRequestError('Handle too long', 'InvalidHandle')
  }

  if (reservedSubdomains[front]) {
    throw new InvalidRequestError('Reserved handle', 'InvalidHandle')
  }

  const isValid = address.isDomainValid(handle)
  if (!isValid) {
    throw new InvalidRequestError(
      'Invalid characters in handle',
      'InvalidHandle',
    )
  }
}
