import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TestPds, TestPlc } from '@atproto/dev-env'
import { Client } from '@atproto/lex'
import type { DidString } from '@atproto/syntax'
import type { AccountDb } from '../src/account-manager/db/index.js'
import type { AppContext } from '../src/context.js'
import { internal } from '../src/lexicons/index.js'

describe('spaces migration recount', () => {
  let plcServer: TestPlc
  let pds: TestPds
  let ctx: AppContext
  let db: AccountDb
  let client: Client

  beforeAll(async () => {
    plcServer = await TestPlc.create({})
    pds = await TestPds.create({
      didPlcUrl: plcServer.url,
      spacesMigration: 'disabled',
    })
    ctx = pds.ctx as unknown as AppContext
    db = ctx.accountManager.db
    client = new Client({ service: pds.url })
    for (let n = 0; n < 3; n++) {
      await pds.getAgent().com.atproto.server.createAccount({
        email: `recount${n}@test.com`,
        handle: `recount${n}.test`,
        password: 'hunter2',
      })
    }
  })

  afterAll(async () => {
    await pds?.close()
    await plcServer?.close()
  })

  // Drift as a write around the stats would leave it
  const drift = () =>
    db.db
      .updateTable('spaces_migration_stats')
      .set((eb) => ({ total: eb('total', '+', 5), failing: 2 }))
      .where('id', '=', 1)
      .execute()

  const recount = (fix?: boolean) =>
    client.call(
      internal.pds.recountSpacesMigration,
      { fix },
      { headers: pds.adminAuthHeaders() },
    )

  it('reports drift without writing on a dry run', async () => {
    await drift()
    const stored = await ctx.spacesMigration.progress.summary()

    const res = await recount()

    expect(res.fixed).toBe(false)
    expect(res.stored).toEqual(stored)
    expect(res.recounted).toEqual(await ctx.spacesMigration.progress.recount())
    expect(res.recounted.total).toBe(stored.total - 5)
    expect(await ctx.spacesMigration.progress.summary()).toEqual(stored)
  })

  it('overwrites the stats with the recount when asked', async () => {
    await drift()

    const res = await recount(true)

    expect(res.fixed).toBe(true)
    expect(res.stored).not.toEqual(res.recounted)
    expect(await ctx.spacesMigration.progress.summary()).toEqual(res.recounted)
  })

  it('loses no write that races it', async () => {
    await drift()
    const fresh = 'did:plc:recountrace0000000000000' as DidString

    // The bump inserts a row; whichever runs first, both land in the stats
    await Promise.all([recount(true), ctx.spacesMigration.progress.bump(fresh)])

    expect(await ctx.spacesMigration.progress.summary()).toEqual(
      await ctx.spacesMigration.progress.recount(),
    )
  })

  it('requires the admin token', async () => {
    await expect(
      client.call(internal.pds.recountSpacesMigration, {}),
    ).rejects.toMatchObject({ error: 'AuthenticationRequired' })
    const { accessJwt } = (
      await pds.getAgent().com.atproto.server.createSession({
        identifier: 'recount0.test',
        password: 'hunter2',
      })
    ).data
    await expect(
      client.call(
        internal.pds.recountSpacesMigration,
        {},
        { headers: { authorization: `Bearer ${accessJwt}` } },
      ),
    ).rejects.toMatchObject({ error: 'AuthenticationRequired' })
  })
})
