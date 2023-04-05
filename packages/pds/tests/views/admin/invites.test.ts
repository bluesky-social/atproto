import AtpAgent from '@atproto/api'
import { runTestServer, forSnapshot, CloseFn, adminAuth } from '../../_util'
import { SeedClient } from '../../seeds/client'
import basicSeed from '../../seeds/basic'
import { randomStr } from '@atproto/crypto'
import { wait } from '@atproto/common'

describe('pds admin invite views', () => {
  let agent: AtpAgent
  let close: CloseFn

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_admin_invites',
      inviteRequired: true,
      userInviteInterval: 1,
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
  })

  afterAll(async () => {
    await close()
  })

  let alice: string

  beforeAll(async () => {
    const adminCode = await agent.api.com.atproto.server.createInviteCode(
      { useCount: 10 },
      { encoding: 'application/json', headers: { authorization: adminAuth() } },
    )

    const aliceRes = await agent.api.com.atproto.server.createAccount({
      handle: 'alice.test',
      email: 'alice@test.com',
      password: 'alice',
      inviteCode: adminCode.data.code,
    })
    alice = aliceRes.data.did
    const bobRes = await agent.api.com.atproto.server.createAccount({
      handle: 'bob.test',
      email: 'bob@test.com',
      password: 'bob',
      inviteCode: adminCode.data.code,
    })

    const aliceCodes = await agent.api.com.atproto.server.getAccountInviteCodes(
      {},
      { headers: { authorization: `Bearer ${aliceRes.data.accessJwt}` } },
    )
    await agent.api.com.atproto.server.getAccountInviteCodes(
      {},
      { headers: { authorization: `Bearer ${bobRes.data.accessJwt}` } },
    )
    await agent.api.com.atproto.server.createInviteCode(
      { useCount: 5, forAccount: aliceRes.data.did },
      { encoding: 'application/json', headers: { authorization: adminAuth() } },
    )
    await agent.api.com.atproto.admin.disableInviteCodes(
      { codes: [adminCode.data.code], accounts: [bobRes.data.did] },
      { encoding: 'application/json', headers: { authorization: adminAuth() } },
    )

    const useCode = async (code: string) => {
      const name = randomStr(8, 'base32')
      await agent.api.com.atproto.server.createAccount({
        handle: `${name}.test`,
        email: `${name}@test.com`,
        password: name,
        inviteCode: code,
      })
    }

    await useCode(aliceCodes.data.codes[0].code)
    await useCode(aliceCodes.data.codes[1].code)
  })

  it('gets a list of invite codes by recency', async () => {
    const result = await agent.api.com.atproto.admin.getInviteCodes(
      {},
      { headers: { authorization: adminAuth() } },
    )
    let lastDate = result.data.codes[0].createdAt
    for (const code of result.data.codes) {
      expect(code.createdAt <= lastDate).toBeTruthy()
      lastDate = code.createdAt
    }
    expect(result.data.codes.length).toBe(12)
    expect(result.data.codes[0]).toMatchObject({
      available: 5,
      disabled: false,
      forAccount: alice,
      createdBy: 'admin',
    })
    expect(result.data.codes[0].uses.length).toBe(0)
    expect(result.data.codes.at(-1)).toMatchObject({
      available: 10,
      disabled: true,
      forAccount: 'admin',
      createdBy: 'admin',
    })
    expect(result.data.codes.at(-1)?.uses.length).toBe(2)
  })

  it('paginates by recency', async () => {
    const full = await agent.api.com.atproto.admin.getInviteCodes(
      {},
      { headers: { authorization: adminAuth() } },
    )
    const first = await agent.api.com.atproto.admin.getInviteCodes(
      { limit: 5 },
      { headers: { authorization: adminAuth() } },
    )
    const second = await agent.api.com.atproto.admin.getInviteCodes(
      { cursor: first.data.cursor },
      { headers: { authorization: adminAuth() } },
    )
    const combined = [...first.data.codes, ...second.data.codes]
    expect(combined).toEqual(full.data.codes)
  })

  it('gets a list of invite codes by usage', async () => {
    const result = await agent.api.com.atproto.admin.getInviteCodes(
      { sort: 'usage' },
      { headers: { authorization: adminAuth() } },
    )
    let lastUseCount = result.data.codes[0].uses.length
    for (const code of result.data.codes) {
      expect(code.uses.length).toBeLessThanOrEqual(lastUseCount)
      lastUseCount = code.uses.length
    }
    expect(result.data.codes[0]).toMatchObject({
      available: 10,
      disabled: true,
      forAccount: 'admin',
      createdBy: 'admin',
    })
    expect(result.data.codes[0].uses.length).toBe(2)
  })

  it('paginates by usage', async () => {
    const full = await agent.api.com.atproto.admin.getInviteCodes(
      { sort: 'usage' },
      { headers: { authorization: adminAuth() } },
    )
    const first = await agent.api.com.atproto.admin.getInviteCodes(
      { sort: 'usage', limit: 5 },
      { headers: { authorization: adminAuth() } },
    )
    const second = await agent.api.com.atproto.admin.getInviteCodes(
      { sort: 'usage', cursor: first.data.cursor },
      { headers: { authorization: adminAuth() } },
    )
    const combined = [...first.data.codes, ...second.data.codes]
    expect(combined).toEqual(full.data.codes)
  })

  it('gets high level invite code info', async () => {
    const res = await agent.api.com.atproto.admin.getInviteCodeUsage(
      {},
      { headers: { authorization: adminAuth() } },
    )
    expect(res.data.admin).toEqual({
      count: 2,
      available: 15,
      used: 2,
      disabled: 1,
    })
    expect(res.data.user).toEqual({
      count: 10,
      available: 10,
      used: 2,
      disabled: 5,
    })
    expect(res.data.total).toEqual({
      count: 12,
      available: 25,
      used: 4,
      disabled: 6,
    })
  })
})
