import { ClientAuth } from '../client/client-auth.js'
import { Client } from '../client/client.js'
import {
  CONFIDENTIAL_CLIENT_REFRESH_LIFETIME,
  CONFIDENTIAL_CLIENT_SESSION_LIFETIME,
  PUBLIC_CLIENT_REFRESH_LIFETIME,
  PUBLIC_CLIENT_SESSION_LIFETIME,
} from '../constants.js'
import { InvalidGrantError } from '../errors/invalid-grant-error.js'
import { RefreshToken } from './refresh-token.js'
import { TokenInfo } from './token-store.js'

export function validateRefreshToken(
  client: Client,
  clientAuth: ClientAuth,
  refreshToken: RefreshToken,
  tokenInfo: TokenInfo,
) {
  // @NOTE this is already checked by consumeRefreshToken but we add it here
  // for extra safety.
  if (tokenInfo.currentRefreshToken !== refreshToken) {
    throw new InvalidGrantError(`Refresh token replayed`)
  }

  const [sessionLifetime, refreshLifetime] =
    clientAuth.method !== 'none' || client.info.isFirstParty
      ? [
          CONFIDENTIAL_CLIENT_SESSION_LIFETIME,
          CONFIDENTIAL_CLIENT_REFRESH_LIFETIME,
        ]
      : [PUBLIC_CLIENT_SESSION_LIFETIME, PUBLIC_CLIENT_REFRESH_LIFETIME]

  const sessionAge = Date.now() - tokenInfo.data.createdAt.getTime()
  const refreshAge = Date.now() - tokenInfo.data.updatedAt.getTime()

  if (sessionAge > sessionLifetime) {
    throw new InvalidGrantError(`Session expired`)
  } else if (refreshAge > refreshLifetime) {
    throw new InvalidGrantError(`Refresh token expired`)
  } else if (refreshAge > sessionAge) {
    throw new InvalidGrantError(`Refresh token is older than session`)
  }
}
