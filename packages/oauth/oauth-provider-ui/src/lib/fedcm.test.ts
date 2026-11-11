import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Account } from '@atproto/oauth-provider-api'
import {
  type FedcmSyncSession,
  completeFedcmLogin,
  syncFedcmRegistration,
  toFedcmPushedAccounts,
} from './fedcm.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe(completeFedcmLogin, () => {
  it('updates the FedCM login status and closes the login window', async () => {
    const setStatus = vi.fn()
    const close = vi.fn()
    vi.stubGlobal('navigator', { login: { setStatus } })
    vi.stubGlobal('window', { IdentityProvider: { close } })

    await completeFedcmLogin()

    expect(setStatus).toHaveBeenCalledWith('logged-in')
    expect(close).toHaveBeenCalledOnce()
  })

  it('tolerates unsupported APIs and browser failures', async () => {
    const setStatus = vi.fn(() => {
      throw new Error('unsupported')
    })
    const close = vi.fn(() => {
      throw new Error('unsupported')
    })
    vi.stubGlobal('navigator', { login: { setStatus } })
    vi.stubGlobal('window', { IdentityProvider: { close } })

    await expect(completeFedcmLogin()).resolves.toBeUndefined()

    expect(setStatus).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })

  it('does nothing when the browser exposes neither API', async () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('window', {})

    await expect(completeFedcmLogin()).resolves.toBeUndefined()
  })
})

const mkSession = (
  account: Partial<Account> & { did: string },
  extra: Partial<Omit<FedcmSyncSession, 'account'>> = {},
): FedcmSyncSession => ({
  account: { deactivated: false, ...account } as Account,
  loginRequired: false,
  ...extra,
})

describe(toFedcmPushedAccounts, () => {
  it('maps remembered active sessions to pushed accounts', () => {
    expect(
      toFedcmPushedAccounts([
        mkSession({
          did: 'did:plc:alice',
          name: 'Alice',
          handle: 'alice.test',
          picture: 'https://cdn/a.jpg',
        }),
      ]),
    ).toEqual([
      {
        id: 'did:plc:alice',
        name: 'Alice',
        email: '@alice.test',
        picture: 'https://cdn/a.jpg',
      },
    ])
  })

  it('falls back to the handle, then the DID', () => {
    const [bob, carol] = toFedcmPushedAccounts([
      mkSession({ did: 'did:plc:bob', handle: 'bob.test' }),
      mkSession({ did: 'did:plc:carol' }),
    ])
    expect(bob).toEqual({
      id: 'did:plc:bob',
      name: '@bob.test',
      email: '@bob.test',
    })
    expect(carol).toEqual({
      id: 'did:plc:carol',
      name: 'did:plc:carol',
      email: 'did:plc:carol',
    })
    expect(JSON.stringify([bob, carol])).not.toContain('undefined')
  })

  it('excludes ephemeral, deactivated and login-required sessions', () => {
    expect(
      toFedcmPushedAccounts([
        mkSession({ did: 'did:plc:e' }, { ephemeralToken: 'tok' }),
        mkSession({ did: 'did:plc:d', deactivated: true }),
        mkSession({ did: 'did:plc:l' }, { loginRequired: true }),
        mkSession({ did: 'did:plc:ok' }),
      ]).map((a) => a.id),
    ).toEqual(['did:plc:ok'])
  })
})

describe(syncFedcmRegistration, () => {
  const data = {
    configUrl: 'https://pds.test/fedcm/config',
    accountsExpiration: 30_000,
  }
  const sessions = [mkSession({ did: 'did:plc:alice', handle: 'alice.test' })]

  it('pushes accounts then registers the config URL', async () => {
    const calls: string[] = []
    const setStatus = vi.fn(() => void calls.push('setStatus'))
    const register = vi.fn(() => {
      calls.push('register')
      return Promise.resolve(true)
    })
    vi.stubGlobal('navigator', { login: { setStatus } })
    vi.stubGlobal('window', { IdentityProvider: { register } })

    await syncFedcmRegistration(data, sessions)

    expect(setStatus).toHaveBeenCalledWith('logged-in', {
      accounts: toFedcmPushedAccounts(sessions),
      expiration: 30_000,
    })
    expect(register).toHaveBeenCalledWith(data.configUrl)
    expect(calls).toEqual(['setStatus', 'register'])
  })

  it('pushes logged-out and does not register when no account remains', async () => {
    const setStatus = vi.fn()
    const register = vi.fn()
    vi.stubGlobal('navigator', { login: { setStatus } })
    vi.stubGlobal('window', { IdentityProvider: { register } })

    await syncFedcmRegistration(data, [
      mkSession({ did: 'did:plc:d', deactivated: true }),
    ])

    expect(setStatus).toHaveBeenCalledOnce()
    expect(setStatus.mock.calls[0]).toEqual(['logged-out'])
    expect(register).not.toHaveBeenCalled()
  })

  it('skips registration when the browser lacks IdentityProvider.register', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const setStatus = vi.fn()
    vi.stubGlobal('navigator', { login: { setStatus } })
    vi.stubGlobal('window', { IdentityProvider: {} })

    await expect(syncFedcmRegistration(data, sessions)).resolves.toBeUndefined()

    expect(setStatus).toHaveBeenCalledOnce()
    expect(warn).not.toHaveBeenCalled()
  })

  it('warns but resolves when the browser rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const setStatus = vi.fn(() => {
      throw new Error('nope')
    })
    const register = vi.fn(() => Promise.reject(new Error('nope')))
    vi.stubGlobal('navigator', { login: { setStatus } })
    vi.stubGlobal('window', { IdentityProvider: { register } })

    await expect(syncFedcmRegistration(data, sessions)).resolves.toBeUndefined()

    expect(setStatus).toHaveBeenCalledOnce()
    expect(register).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalledTimes(2)
  })
})
