import { describe, expect, it } from 'vitest'
import type { DeviceAccount } from '../../account/account-store.js'
import type { OAuthProvider } from '../../oauth-provider.js'
import { getFedcmRegistrationData } from './fedcm-registration-data.js'

type Server = Pick<OAuthProvider, 'fedcm' | 'issuer' | 'authenticationMaxAge'>

const server = {
  fedcm: {},
  issuer: 'https://pds.example',
  authenticationMaxAge: 30_000,
} as Server

const eligible = [
  { account: { did: 'did:plc:alice' } },
  { account: { did: 'did:plc:bob' } },
] as unknown as DeviceAccount[]

describe(getFedcmRegistrationData, () => {
  it('provides registration data with the eligible DIDs when FedCM is enabled', () => {
    expect(getFedcmRegistrationData(server, eligible)).toEqual({
      configUrl: 'https://pds.example/oauth/fedcm/config.json',
      accountsExpiration: 30_000,
      eligibleDids: ['did:plc:alice', 'did:plc:bob'],
    })
  })

  it('provides an empty eligible list when no account is eligible', () => {
    expect(getFedcmRegistrationData(server, [])).toMatchObject({
      eligibleDids: [],
    })
  })

  it('provides nothing when FedCM is disabled', () => {
    expect(
      getFedcmRegistrationData({ ...server, fedcm: undefined }, eligible),
    ).toBeUndefined()
  })
})
