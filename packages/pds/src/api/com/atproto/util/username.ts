import { InvalidRequestError } from '@atproto/xrpc-server'
import * as address from '@sideway/address'
import { reservedSubdomains } from './username-reserved'

export const ensureUsernameValid = (
  username: string,
  availableUserDomains: string[],
): void => {
  if (username.startsWith('did:')) {
    throw new InvalidRequestError(
      'Cannot register a username that starts with `did:`',
      'InvalidUsername',
    )
  }
  const supportedDomain = availableUserDomains.find((domain) =>
    username.endsWith(domain),
  )
  if (!supportedDomain) {
    throw new InvalidRequestError(
      'Not a supported username domain',
      'InvalidUsername',
    )
  }
  const front = username.slice(0, username.length - supportedDomain.length)
  if (front.length < 2) {
    throw new InvalidRequestError('Username too short', 'InvalidUsername')
  } else if (front.length > 20) {
    throw new InvalidRequestError('Username too long', 'InvalidUsername')
  }

  if (reservedSubdomains[front]) {
    throw new InvalidRequestError('Reserved username', 'InvalidUsername')
  }

  const isValid = address.isDomainValid(username)
  if (!isValid) {
    throw new InvalidRequestError(
      'Invalid characters in username',
      'InvalidUsername',
    )
  }
}
