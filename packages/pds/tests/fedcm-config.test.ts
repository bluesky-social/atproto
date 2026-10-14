import { envToCfg } from '../src/config/config.js'

const env = {
  hostname: 'pds.example.com',
  blobstoreDiskLocation: '/tmp/fedcm-config-test',
}

describe('FedCM configuration', () => {
  it('requires explicit enablement', () => {
    expect(envToCfg(env).oauth.provider?.fedcm).toBeUndefined()
    expect(
      envToCfg({ ...env, oauthFedcmEnabled: true }).oauth.provider?.fedcm,
    ).toEqual({ allowLoopbackClients: undefined })
  })

  it('permits loopback clients only in development mode', () => {
    const enabled = {
      ...env,
      oauthFedcmEnabled: true,
      oauthFedcmAllowLoopbackClients: true,
    }

    expect(
      envToCfg({ ...enabled, devMode: false }).oauth.provider?.fedcm
        ?.allowLoopbackClients,
    ).toBe(false)
    expect(
      envToCfg({ ...enabled, devMode: true }).oauth.provider?.fedcm
        ?.allowLoopbackClients,
    ).toBe(true)
  })

  it('rejects an HTTP localhost deployment', () => {
    expect(() =>
      envToCfg({ ...env, hostname: 'localhost', oauthFedcmEnabled: true }),
    ).toThrow('FedCM requires an HTTPS PDS hostname')
  })
})
