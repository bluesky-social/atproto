import { describe, expect, it, vi } from 'vitest'
import type { Account } from '@atproto/oauth-provider-api'
import type { AccountManager } from './account-manager.js'
import { resolveLoginHint } from './login-hint.js'

const aliceDid = 'did:plc:2ihkmqhirw5tturitpdyf2fa'

const alice = {
  did: aliceDid,
  pds: 'did:web:pds.example.com',
  deactivated: false,
  handle: 'alice.test',
} as Account

const managerFor = (result: Account | Error) =>
  ({
    getAccount: vi.fn(async () => {
      if (result instanceof Error) throw result
      return { account: result, authorizedClients: new Map() }
    }),
  }) satisfies Pick<AccountManager, 'getAccount'>

describe(resolveLoginHint, () => {
  it('resolves a DID hint to the account handle', async () => {
    const manager = managerFor(alice)
    await expect(resolveLoginHint(aliceDid, manager)).resolves.toBe(
      'alice.test',
    )
    expect(manager.getAccount).toHaveBeenCalledWith(aliceDid)
  })

  it('returns the DID unchanged when the account has no handle', async () => {
    const manager = managerFor({ ...alice, handle: undefined } as Account)
    await expect(resolveLoginHint(aliceDid, manager)).resolves.toBe(aliceDid)
  })

  it('returns the DID unchanged when the account is unknown', async () => {
    const manager = managerFor(new Error('Account not found'))
    await expect(resolveLoginHint(aliceDid, manager)).resolves.toBe(aliceDid)
  })

  it('leaves handle hints unchanged without a lookup', async () => {
    const manager = managerFor(alice)
    await expect(resolveLoginHint('alice.test', manager)).resolves.toBe(
      'alice.test',
    )
    expect(manager.getAccount).not.toHaveBeenCalled()
  })

  it('returns undefined when no hint is provided', async () => {
    const manager = managerFor(alice)
    await expect(resolveLoginHint(undefined, manager)).resolves.toBeUndefined()
    expect(manager.getAccount).not.toHaveBeenCalled()
  })
})
