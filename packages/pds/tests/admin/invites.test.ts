import { TestNetworkNoAppView, SeedClient } from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import { randomStr } from '@atproto/crypto'

describe('pds admin invite views', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'views_admin_invites',
      pds: {
        inviteRequired: true,
        inviteInterval: 1,
      },
    })
    agent = network.pds.getClient()
    sc = network.getSeedClient()
  })

  afterAll(async () => {
    await network.close()
  })

  let alice: string
  let bob: string
  let carol: string

  beforeAll(async () => {
    const adminCode = await agent.api.com.atproto.server.createInviteCode(
      { useCount: 10 },
      { encoding: 'application/json', headers: network.pds.adminAuthHeaders() },
    )

    await sc.createAccount('alice', {
      handle: 'alice.test',
      email: 'alice@test.com',
      password: 'alice',
      inviteCode: adminCode.data.code,
    })
    await sc.createAccount('bob', {
      handle: 'bob.test',
      email: 'bob@test.com',
      password: 'bob',
      inviteCode: adminCode.data.code,
    })
    await sc.createAccount('carol', {
      handle: 'carol.test',
      email: 'carol@test.com',
      password: 'carol',
      inviteCode: adminCode.data.code,
    })

    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol

    const aliceCodes = await agent.api.com.atproto.server.getAccountInviteCodes(
      {},
      { headers: sc.getHeaders(alice) },
    )
    await agent.api.com.atproto.server.getAccountInviteCodes(
      {},
      { headers: sc.getHeaders(bob) },
    )
    await agent.api.com.atproto.server.createInviteCode(
      { useCount: 5, forAccount: alice },
      { encoding: 'application/json', headers: network.pds.adminAuthHeaders() },
    )
    await agent.api.com.atproto.admin.disableInviteCodes(
      { codes: [adminCode.data.code], accounts: [bob] },
      { encoding: 'application/json', headers: network.pds.adminAuthHeaders() },
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
      { headers: network.pds.adminAuthHeaders() },
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
    expect(result.data.codes.at(-1)?.uses.length).toBe(3)
  })

  it('paginates by recency', async () => {
    const full = await agent.api.com.atproto.admin.getInviteCodes(
      {},
      { headers: network.pds.adminAuthHeaders() },
    )
    const first = await agent.api.com.atproto.admin.getInviteCodes(
      { limit: 5 },
      { headers: network.pds.adminAuthHeaders() },
    )
    const second = await agent.api.com.atproto.admin.getInviteCodes(
      { cursor: first.data.cursor },
      { headers: network.pds.adminAuthHeaders() },
    )
    const combined = [...first.data.codes, ...second.data.codes]
    expect(combined).toEqual(full.data.codes)
  })

  it('gets a list of invite codes by usage', async () => {
    const result = await agent.api.com.atproto.admin.getInviteCodes(
      { sort: 'usage' },
      { headers: network.pds.adminAuthHeaders() },
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
    expect(result.data.codes[0].uses.length).toBe(3)
  })

  it('paginates by usage', async () => {
    const full = await agent.api.com.atproto.admin.getInviteCodes(
      { sort: 'usage' },
      { headers: network.pds.adminAuthHeaders() },
    )
    const first = await agent.api.com.atproto.admin.getInviteCodes(
      { sort: 'usage', limit: 5 },
      { headers: network.pds.adminAuthHeaders() },
    )
    const second = await agent.api.com.atproto.admin.getInviteCodes(
      { sort: 'usage', cursor: first.data.cursor },
      { headers: network.pds.adminAuthHeaders() },
    )
    const combined = [...first.data.codes, ...second.data.codes]
    expect(combined).toEqual(full.data.codes)
  })

  it('filters admin.searchRepos by invitedBy', async () => {
    const searchView = await agent.api.com.atproto.admin.searchRepos(
      { invitedBy: alice },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(searchView.data.repos.length).toBe(2)
    expect(searchView.data.repos[0].invitedBy?.available).toBe(1)
    expect(searchView.data.repos[0].invitedBy?.uses.length).toBe(1)
    expect(searchView.data.repos[1].invitedBy?.available).toBe(1)
    expect(searchView.data.repos[1].invitedBy?.uses.length).toBe(1)
  })

  it('hydrates invites into admin.getRepo', async () => {
    const aliceView = await agent.api.com.atproto.admin.getRepo(
      { did: alice },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(aliceView.data.invitedBy?.available).toBe(10)
    expect(aliceView.data.invitedBy?.uses.length).toBe(3)
    expect(aliceView.data.invites?.length).toBe(6)
  })

  it('does not allow non-admin moderators to disable invites.', async () => {
    const attemptDisableInvites =
      agent.api.com.atproto.admin.disableInviteCodes(
        { codes: ['x'], accounts: [alice] },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders('moderator'),
        },
      )
    await expect(attemptDisableInvites).rejects.toThrow(
      'Insufficient privileges',
    )
  })

  it('does not allow non-admin moderators to create invites.', async () => {
    const attemptCreateInvite = agent.api.com.atproto.server.createInviteCode(
      { useCount: 5, forAccount: alice },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders('moderator'),
      },
    )
    await expect(attemptCreateInvite).rejects.toThrow('Insufficient privileges')
  })

  it('disables an account from getting additional invite codes', async () => {
    const reasonForDisabling = 'User is selling invites'
    await agent.api.com.atproto.admin.disableAccountInvites(
      { account: carol, note: reasonForDisabling },
      { encoding: 'application/json', headers: network.pds.adminAuthHeaders() },
    )

    const repoRes = await agent.api.com.atproto.admin.getRepo(
      { did: carol },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(repoRes.data.invitesDisabled).toBe(true)
    expect(repoRes.data.inviteNote).toBe(reasonForDisabling)

    const invRes = await agent.api.com.atproto.server.getAccountInviteCodes(
      {},
      { headers: sc.getHeaders(carol) },
    )
    expect(invRes.data.codes.length).toBe(0)
  })

  it('allows setting reason when enabling and disabling invite codes', async () => {
    const reasonForEnabling = 'User is confirmed they will play nice'
    const reasonForDisabling = 'User is selling invites'
    await agent.api.com.atproto.admin.enableAccountInvites(
      { account: carol, note: reasonForEnabling },
      { encoding: 'application/json', headers: network.pds.adminAuthHeaders() },
    )

    const afterEnable = await agent.api.com.atproto.admin.getRepo(
      { did: carol },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(afterEnable.data.invitesDisabled).toBe(false)
    expect(afterEnable.data.inviteNote).toBe(reasonForEnabling)

    await agent.api.com.atproto.admin.disableAccountInvites(
      { account: carol, note: reasonForDisabling },
      { encoding: 'application/json', headers: network.pds.adminAuthHeaders() },
    )

    const afterDisable = await agent.api.com.atproto.admin.getRepo(
      { did: carol },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(afterDisable.data.invitesDisabled).toBe(true)
    expect(afterDisable.data.inviteNote).toBe(reasonForDisabling)
  })

  it('creates codes in the background but disables them', async () => {
    const res = await network.pds.ctx.db.db
      .selectFrom('invite_code')
      .where('forUser', '=', carol)
      .selectAll()
      .execute()
    expect(res.length).toBe(5)
    expect(res.every((row) => row.disabled === 1))
  })

  it('does not allow non-admin moderations to disable account invites', async () => {
    const attempt = agent.api.com.atproto.admin.disableAccountInvites(
      { account: alice },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders('moderator'),
      },
    )
    await expect(attempt).rejects.toThrow('Insufficient privileges')
  })

  it('re-enables an accounts invites', async () => {
    await agent.api.com.atproto.admin.enableAccountInvites(
      { account: carol },
      { encoding: 'application/json', headers: network.pds.adminAuthHeaders() },
    )

    const repoRes = await agent.api.com.atproto.admin.getRepo(
      { did: carol },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(repoRes.data.invitesDisabled).toBe(false)

    const invRes = await agent.api.com.atproto.server.getAccountInviteCodes(
      {},
      { headers: sc.getHeaders(carol) },
    )
    expect(invRes.data.codes.length).toBeGreaterThan(0)
  })

  it('does not allow non-admin moderations to enable account invites', async () => {
    const attempt = agent.api.com.atproto.admin.enableAccountInvites(
      { account: alice },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders('moderator'),
      },
    )
    await expect(attempt).rejects.toThrow('Insufficient privileges')
  })
})
