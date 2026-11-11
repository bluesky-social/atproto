import { describe, expect, it } from 'vitest'
import type { OAuthProvider } from '../../oauth-provider.js'
import { getFedcmRegistrationData } from './fedcm-registration-data.js'

type Server = Pick<OAuthProvider, 'fedcm' | 'issuer' | 'authenticationMaxAge'>

describe('getFedcmRegistrationData', () => {
  it('provides registration data only when FedCM is enabled', () => {
    const server: Server = {
      fedcm: {},
      issuer: 'https://pds.example',
      authenticationMaxAge: 30_000,
    } as Server
    expect(getFedcmRegistrationData(server)).toEqual({
      configUrl: 'https://pds.example/oauth/fedcm/config.json',
      accountsExpiration: 30_000,
    })
    expect(
      getFedcmRegistrationData({ ...server, fedcm: undefined }),
    ).toBeUndefined()
  })
})
