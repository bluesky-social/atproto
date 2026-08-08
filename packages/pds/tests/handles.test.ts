import { jest } from '@jest/globals'
import type { AtpAgent } from '@atproto/api'
import type { SeedClient } from '@atproto/dev-env'
import type { AtIdentifierString, DidString } from '@atproto/syntax'
import type { AppContext } from '../src/index.js'
import { createSelfCustodiedAccount } from './_util.js'

// outside of suite so they can be used in mock
let alice: DidString
let bob: DidString

jest.unstable_mockModule('node:dns/promises', () => {
  return {
    resolveTxt: (domain: string) => {
      if (domain === '_atproto.alice.external') {
        return [[`did=${alice}`]]
      }
      if (domain === '_atproto.bob.external') {
        return [[`did=${bob}`]]
      }
      return []
    },
  }
})

// Dynamic imports so jest.unstable_mockModule() registers before these modules
// load node:dns/promises. Static imports link the full dep graph before any code
// evaluates, which would bypass the mock. Remove once migrated to vitest.
const { IdResolver } = await import('@atproto/identity')
const { TestNetworkNoAppView } = await import('@atproto/dev-env')
const { default: basicSeed } = await import('./seeds/basic.js')

describe('handles', () => {
  let network: InstanceType<typeof TestNetworkNoAppView>
  let agent: AtpAgent
  let sc: SeedClient
  let ctx: AppContext
  let idResolver: InstanceType<typeof IdResolver>

  const newHandle = 'alice2.test'

  const tryHandle = async (handle: string) => {
    await agent.com.atproto.identity.updateHandle(
      { handle },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
  }

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'handles',
    })
    ctx = network.pds.ctx
    idResolver = new IdResolver({ plcUrl: ctx.cfg.identity.plcUrl })
    agent = network.pds.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
  })

  afterAll(async () => {
    await network?.close()
  })

  const getHandleFromDb = async (
    did: AtIdentifierString,
  ): Promise<string | undefined> => {
    const res = await ctx.accountManager.getAccount(did)
    return res?.handle ?? undefined
  }

  it('resolves handles', async () => {
    const res = await agent.api.com.atproto.identity.resolveHandle({
      handle: 'alice.test',
    })
    expect(res.data.did).toBe(alice)
  })

  it('resolves non-normalize handles', async () => {
    const res = await agent.api.com.atproto.identity.resolveHandle({
      handle: 'aLicE.tEst',
    })
    expect(res.data.did).toBe(alice)
  })

  it('allows a user to change their handle', async () => {
    await agent.api.com.atproto.identity.updateHandle(
      { handle: newHandle },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    const attemptOld = agent.api.com.atproto.identity.resolveHandle({
      handle: 'alice.test',
    })
    await expect(attemptOld).rejects.toThrow('Unable to resolve handle')
    const attemptNew = await agent.api.com.atproto.identity.resolveHandle({
      handle: newHandle,
    })
    expect(attemptNew.data.did).toBe(alice)
  })

  it('updates their did document', async () => {
    const data = await idResolver.did.resolveAtprotoData(alice)
    expect(data.handle).toBe(newHandle)
  })

  it('allows a user to login with their new handle', async () => {
    const res = await agent.api.com.atproto.server.createSession({
      identifier: newHandle,
      password: sc.accounts[alice].password,
    })
    sc.accounts[alice].accessJwt = res.data.accessJwt
    sc.accounts[alice].refreshJwt = res.data.refreshJwt
  })

  it('does not allow taking a handle that already exists', async () => {
    const attempt = agent.api.com.atproto.identity.updateHandle(
      { handle: 'Bob.test' },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    await expect(attempt).rejects.toThrow('Handle already taken: bob.test')
  })

  it('handle updates are idempotent', async () => {
    await agent.api.com.atproto.identity.updateHandle(
      { handle: 'Bob.test' },
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )
  })

  it('if handle update fails, it does not update their did document', async () => {
    const data = await idResolver.did.resolveAtprotoData(alice)
    expect(data.handle).toBe(newHandle)
  })

  it('disallows handles that do not resolve to a DID', async () => {
    await expect(tryHandle('john.bsky.io')).rejects.toThrow(
      'External handle did not resolve to DID',
    )
  })

  it('validates input through lexicon schema', async () => {
    for (const invalidHandle of [
      'did:john',
      'jo_hn.test',
      'jo!hn.test',
      'jo%hn.test',
      'jo&hn.test',
      'jo*hn.test',
      'jo|hn.test',
      'jo:hn.test',
      'jo/hn.test',
    ]) {
      await expect(tryHandle(invalidHandle)).rejects.toMatchObject({
        error: 'InvalidRequest',
        message: expect.stringContaining('handle'),
      })
    }
  })

  it('applies PDS specific handle length constraints', async () => {
    await expect(tryHandle('j.test')).rejects.toMatchObject({
      error: 'InvalidHandle',
      message: 'Handle too short',
    })
    await expect(
      tryHandle('jayromy-johnber12345678910.test'),
    ).rejects.toMatchObject({
      error: 'InvalidHandle',
      message: 'Handle too long',
    })
  })

  it('disallows reserved handles', async () => {
    await expect(tryHandle('about.test')).rejects.toMatchObject({
      error: 'HandleNotAvailable',
      message: 'Reserved handle',
    })
    await expect(tryHandle('atp.test')).rejects.toMatchObject({
      error: 'HandleNotAvailable',
      message: 'Reserved handle',
    })
  })

  it('allows updating to a dns handles', async () => {
    await agent.api.com.atproto.identity.updateHandle(
      {
        handle: 'alice.external',
      },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    const dbHandle = await getHandleFromDb(alice)
    expect(dbHandle).toBe('alice.external')

    const data = await idResolver.did.resolveAtprotoData(alice)
    expect(data.handle).toBe('alice.external')
  })

  it('does not allow updating to an invalid dns handle', async () => {
    const attempt = agent.api.com.atproto.identity.updateHandle(
      {
        handle: 'bob.external',
      },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    await expect(attempt).rejects.toThrow(
      'External handle did not resolve to DID',
    )

    const attempt2 = agent.api.com.atproto.identity.updateHandle(
      {
        handle: 'noexist.external',
      },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    await expect(attempt2).rejects.toThrow(
      'External handle did not resolve to DID',
    )

    const dbHandle = await getHandleFromDb(alice)
    expect(dbHandle).toBe('alice.external')
  })

  it('allows admin overrules of service domains', async () => {
    await agent.api.com.atproto.admin.updateAccountHandle(
      {
        did: bob,
        handle: 'bob-alt.test',
      },
      {
        headers: network.pds.adminAuthHeaders(),
        encoding: 'application/json',
      },
    )

    const dbHandle = await getHandleFromDb(bob)
    expect(dbHandle).toBe('bob-alt.test')
  })

  it('allows admin override of reserved domains', async () => {
    await agent.api.com.atproto.admin.updateAccountHandle(
      {
        did: bob,
        handle: 'dril.test',
      },
      {
        headers: network.pds.adminAuthHeaders(),
        encoding: 'application/json',
      },
    )

    const dbHandle = await getHandleFromDb(bob)
    expect(dbHandle).toBe('dril.test')
  })

  it('requires admin auth', async () => {
    const attempt = agent.api.com.atproto.admin.updateAccountHandle(
      {
        did: bob,
        handle: 'bob-alt.test',
      },
      {
        headers: sc.getHeaders(bob),
        encoding: 'application/json',
      },
    )
    await expect(attempt).rejects.toThrow('Authentication Required')
    const attempt2 = agent.api.com.atproto.admin.updateAccountHandle({
      did: bob,
      handle: 'bob-alt.test',
    })
    await expect(attempt2).rejects.toThrow('Authentication Required')
  })

  it('fails cleanly when the server no longer holds the rotation key', async () => {
    const { account: erin } = await createSelfCustodiedAccount(sc, ctx, 'erin')

    const attempt = agent.api.com.atproto.identity.updateHandle(
      { handle: 'erin2.test' },
      { headers: sc.getHeaders(erin.did), encoding: 'application/json' },
    )
    await expect(attempt).rejects.toThrow(
      "Rotation keys do not include server's rotation key",
    )

    const dbHandle = await getHandleFromDb(erin.did)
    expect(dbHandle).toBe('erin.test')
  })

  it('fails cleanly when the did is tombstoned', async () => {
    const jill = await sc.createAccount('jill', {
      handle: 'jill.test',
      email: 'jill@test.com',
      password: 'jill-pass',
    })
    await ctx.plcClient.tombstone(jill.did, ctx.plcRotationKey)

    const attempt = agent.api.com.atproto.identity.updateHandle(
      { handle: 'jill2.test' },
      { headers: sc.getHeaders(jill.did), encoding: 'application/json' },
    )
    await expect(attempt).rejects.toThrow('Did is tombstoned')

    const dbHandle = await getHandleFromDb(jill.did)
    expect(dbHandle).toBe('jill.test')
  })

  it('updates locally when a self-custodied account already published the change', async () => {
    const { account: mona, key: monaKey } = await createSelfCustodiedAccount(
      sc,
      ctx,
      'mona',
    )

    // Simulates the owner's own client publishing the change before telling
    // the PDS about it - the PDS is no longer a rotation key for this DID,
    // so it could not have signed this itself.
    await ctx.plcClient.updateHandle(mona.did, monaKey, 'mona2.test')

    await agent.api.com.atproto.identity.updateHandle(
      { handle: 'mona2.test' },
      { headers: sc.getHeaders(mona.did), encoding: 'application/json' },
    )

    const dbHandle = await getHandleFromDb(mona.did)
    expect(dbHandle).toBe('mona2.test')
  })

  it('updates locally when a self-custodied account published a differently-cased handle', async () => {
    const { account: olga, key: olgaKey } = await createSelfCustodiedAccount(
      sc,
      ctx,
      'olga',
    )

    // Handles are case-insensitive, but plc.directory doesn't normalize
    // alsoKnownAs entries - a self-custodied user's own tooling might not
    // lowercase it the way our own signing path always does.
    await ctx.plcClient.updateHandle(olga.did, olgaKey, 'Olga2.test')

    await agent.api.com.atproto.identity.updateHandle(
      { handle: 'olga2.test' },
      { headers: sc.getHeaders(olga.did), encoding: 'application/json' },
    )

    const dbHandle = await getHandleFromDb(olga.did)
    expect(dbHandle).toBe('olga2.test')
  })

  it('does not submit a redundant plc operation when retrying an already-applied handle update', async () => {
    const nora = await sc.createAccount('nora', {
      handle: 'nora.test',
      email: 'nora@test.com',
      password: 'nora-pass',
    })

    // Simulates a previous call whose plc update succeeded but which failed
    // before the local db write, per updateHandle's @NOTE on not rolling
    // back - the caller just calls updateHandle again with the same handle.
    await ctx.plcClient.updateHandle(nora.did, ctx.plcRotationKey, 'nora2.test')
    const logBefore = await ctx.plcClient.getOperationLog(nora.did)

    await agent.api.com.atproto.identity.updateHandle(
      { handle: 'nora2.test' },
      { headers: sc.getHeaders(nora.did), encoding: 'application/json' },
    )

    const logAfter = await ctx.plcClient.getOperationLog(nora.did)
    expect(logAfter.length).toBe(logBefore.length)

    const dbHandle = await getHandleFromDb(nora.did)
    expect(dbHandle).toBe('nora2.test')
  })

  it('skips the update when the first at:// entry already matches, leaving a later one untouched', async () => {
    const pia = await sc.createAccount('pia', {
      handle: 'pia.test',
      email: 'pia@test.com',
      password: 'pia-pass',
    })
    // Directly construct a doc with two at:// entries, since our own
    // updateHandleOp-based code never produces this - it always replaces
    // the first one it finds rather than adding a second.
    await ctx.plcClient.updateData(pia.did, ctx.plcRotationKey, (op) => ({
      ...op,
      alsoKnownAs: ['at://pia2.test', 'at://pia-stale.test'],
    }))
    const logBefore = await ctx.plcClient.getOperationLog(pia.did)

    await agent.api.com.atproto.identity.updateHandle(
      { handle: 'pia2.test' },
      { headers: sc.getHeaders(pia.did), encoding: 'application/json' },
    )

    const logAfter = await ctx.plcClient.getOperationLog(pia.did)
    expect(logAfter.length).toBe(logBefore.length)

    const didData = await ctx.plcClient.getDocumentData(pia.did)
    expect(didData.alsoKnownAs).toEqual([
      'at://pia2.test',
      'at://pia-stale.test',
    ])

    const dbHandle = await getHandleFromDb(pia.did)
    expect(dbHandle).toBe('pia2.test')
  })

  it('signs an update, creating a duplicate, when the matching handle is not the first at:// entry', async () => {
    const quinn = await sc.createAccount('quinn', {
      handle: 'quinn.test',
      email: 'quinn@test.com',
      password: 'quinn-pass',
    })
    await ctx.plcClient.updateData(quinn.did, ctx.plcRotationKey, (op) => ({
      ...op,
      alsoKnownAs: ['at://quinn-stale.test', 'at://quinn2.test'],
    }))
    const logBefore = await ctx.plcClient.getOperationLog(quinn.did)

    await agent.api.com.atproto.identity.updateHandle(
      { handle: 'quinn2.test' },
      { headers: sc.getHeaders(quinn.did), encoding: 'application/json' },
    )

    const logAfter = await ctx.plcClient.getOperationLog(quinn.did)
    expect(logAfter.length).toBe(logBefore.length + 1)

    const didData = await ctx.plcClient.getDocumentData(quinn.did)
    // updateHandleOp only ever replaces the first at:// entry it finds, so
    // this is now a duplicate of the second, unrelated to the update itself
    expect(didData.alsoKnownAs).toEqual([
      'at://quinn2.test',
      'at://quinn2.test',
    ])

    const dbHandle = await getHandleFromDb(quinn.did)
    expect(dbHandle).toBe('quinn2.test')
  })

  it('adds a handle when the did document has none yet', async () => {
    const rex = await sc.createAccount('rex', {
      handle: 'rex.test',
      email: 'rex@test.com',
      password: 'rex-pass',
    })
    await ctx.plcClient.updateData(rex.did, ctx.plcRotationKey, (op) => ({
      ...op,
      alsoKnownAs: [],
    }))

    await agent.api.com.atproto.identity.updateHandle(
      { handle: 'rex2.test' },
      { headers: sc.getHeaders(rex.did), encoding: 'application/json' },
    )

    const didData = await ctx.plcClient.getDocumentData(rex.did)
    expect(didData.alsoKnownAs).toEqual(['at://rex2.test'])

    const dbHandle = await getHandleFromDb(rex.did)
    expect(dbHandle).toBe('rex2.test')
  })
})
