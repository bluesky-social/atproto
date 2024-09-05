import { AtpAgent, ComAtprotoServerCreateAccount } from '@atproto/api'
import { DAY } from '@atproto/common'
import * as crypto from '@atproto/crypto'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { AppContext } from '../src'
import { genInvCodes } from '../src/api/com/atproto/server/util'

describe('account', () => {
  let network: TestNetworkNoAppView
  let ctx: AppContext
  let agent: AtpAgent

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'invite_codes',
      pds: {
        inviteRequired: true,
        inviteInterval: DAY,
        inviteEpoch: Date.now() - 3 * DAY,
      },
    })
    // @ts-expect-error Error due to circular dependency with the dev-env package
    ctx = network.pds.ctx
    agent = network.pds.getClient()
  })

  afterAll(async () => {
    await network.close()
  })

  it('describes the fact that invites are required', async () => {
    const res = await agent.api.com.atproto.server.describeServer({})
    expect(res.data.inviteCodeRequired).toBe(true)
  })

  it('succeeds with a valid code', async () => {
    const code = await createInviteCode(network, agent, 1)
    await createAccountWithInvite(agent, code)
  })

  it('fails on bad invite code', async () => {
    const promise = createAccountWithInvite(agent, 'fake-invite')
    await expect(promise).rejects.toThrow(
      ComAtprotoServerCreateAccount.InvalidInviteCodeError,
    )
  })

  it('fails on invite code from takendown account', async () => {
    const account = await makeLoggedInAccount(network, agent)
    // assign an invite code to the user
    const code = await createInviteCode(network, agent, 1, account.did)
    // takedown the user's account
    const subject = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: account.did,
    }
    await agent.api.com.atproto.admin.updateSubjectStatus(
      {
        subject,
        takedown: { applied: true },
      },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders(),
      },
    )
    // attempt to create account with the previously generated invite code
    const promise = createAccountWithInvite(agent, code)
    await expect(promise).rejects.toThrow(
      ComAtprotoServerCreateAccount.InvalidInviteCodeError,
    )

    // double check that reversing the takedown action makes the invite code valid again
    await agent.api.com.atproto.admin.updateSubjectStatus(
      {
        subject,
        takedown: { applied: false },
      },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders(),
      },
    )
    // attempt to create account with the previously generated invite code
    await createAccountWithInvite(agent, code)
  })

  it('fails on used up invite code', async () => {
    const code = await createInviteCode(network, agent, 2)
    await createAccountsWithInvite(agent, code, 2)
    const promise = createAccountWithInvite(agent, code)
    await expect(promise).rejects.toThrow(
      ComAtprotoServerCreateAccount.InvalidInviteCodeError,
    )
  })

  it('handles racing invite code uses', async () => {
    const inviteCode = await createInviteCode(network, agent, 1)
    const COUNT = 10

    let successes = 0
    let failures = 0
    const promises: Promise<unknown>[] = []
    for (let i = 0; i < COUNT; i++) {
      const attempt = async () => {
        try {
          await createAccountWithInvite(agent, inviteCode)
          successes++
        } catch (err) {
          failures++
        }
      }
      promises.push(attempt())
    }
    await Promise.all(promises)
    expect(successes).toBe(1)
    expect(failures).toBe(9)
  })

  it('allow users to get available user invites', async () => {
    const account = await makeLoggedInAccount(network, agent)

    // no codes available yet
    const res1 = await account.com.atproto.server.getAccountInviteCodes()
    expect(res1.data.codes.length).toBe(0)

    // next, pretend account was made 2 days in the past
    const twoDaysAgo = new Date(Date.now() - 2 * DAY).toISOString()
    await ctx.accountManager.db.db
      .updateTable('actor')
      .set({ createdAt: twoDaysAgo })
      .where('did', '=', account.accountDid)
      .execute()
    const res2 = await account.com.atproto.server.getAccountInviteCodes()
    expect(res2.data.codes.length).toBe(2)

    // use both invites and confirm we can't get any more
    for (const code of res2.data.codes) {
      await createAccountWithInvite(agent, code.code)
    }

    const res3 = await account.com.atproto.server.getAccountInviteCodes()
    expect(res3.data.codes.length).toBe(2)
  })

  it('admin gifted codes to not impact a users available codes', async () => {
    const account = await makeLoggedInAccount(network, agent)

    // again, pretend account was made 2 days ago
    const twoDaysAgo = new Date(Date.now() - 2 * DAY).toISOString()
    await ctx.accountManager.db.db
      .updateTable('actor')
      .set({ createdAt: twoDaysAgo })
      .where('did', '=', account.accountDid)
      .execute()

    await createInviteCode(network, agent, 1, account.accountDid)
    await createInviteCode(network, agent, 1, account.accountDid)
    await createInviteCode(network, agent, 1, account.accountDid)

    const res = await account.com.atproto.server.getAccountInviteCodes()
    expect(res.data.codes.length).toBe(5)

    const fromAdmin = res.data.codes.filter(
      (code) => code.createdBy === 'admin',
    )
    expect(fromAdmin.length).toBe(3)

    const fromSelf = res.data.codes.filter(
      (code) => code.createdBy === account.accountDid,
    )
    expect(fromSelf.length).toBe(2)
  })

  it('creates invites based on epoch', async () => {
    const account = await makeLoggedInAccount(network, agent)

    // first, pretend account was made 2 days ago & get those two codes
    const twoDaysAgo = new Date(Date.now() - 2 * DAY).toISOString()
    await ctx.accountManager.db.db
      .updateTable('actor')
      .set({ createdAt: twoDaysAgo })
      .where('did', '=', account.accountDid)
      .execute()

    const res1 = await account.com.atproto.server.getAccountInviteCodes()
    expect(res1.data.codes.length).toBe(2)

    // then pretend account was made ever so slightly over 10 days ago
    const tenDaysAgo = new Date(Date.now() - 10.01 * DAY).toISOString()
    await ctx.accountManager.db.db
      .updateTable('actor')
      .set({ createdAt: tenDaysAgo })
      .where('did', '=', account.accountDid)
      .execute()

    // we have a 3 day epoch so should still get 3 code
    const res2 = await account.com.atproto.server.getAccountInviteCodes()
    expect(res2.data.codes.length).toBe(3)

    // use up these codes
    for (const code of res2.data.codes) {
      await createAccountWithInvite(agent, code.code)
    }

    // we pad their account with some additional unused codes from the past which should not allow them to generate anymore
    const inviteRows = genInvCodes(ctx.cfg, 10).map((code) => ({
      code: code,
      availableUses: 1,
      disabled: 0 as const,
      forAccount: account.accountDid,
      createdBy: account.accountDid,
      createdAt: new Date(Date.now() - 5 * DAY).toISOString(),
    }))
    await ctx.accountManager.db.db
      .insertInto('invite_code')
      .values(inviteRows)
      .execute()
    const res3 = await account.com.atproto.server.getAccountInviteCodes({
      includeUsed: false,
    })
    expect(res3.data.codes.length).toBe(10)

    // no we use the codes which should still not allow them to generate anymore
    await ctx.accountManager.db.db
      .insertInto('invite_code_use')
      .values(
        inviteRows.map((row) => ({
          code: row.code,
          usedBy: 'did:example:test',
          usedAt: new Date().toISOString(),
        })),
      )
      .execute()

    const res4 = await account.com.atproto.server.getAccountInviteCodes({
      includeUsed: false,
    })
    expect(res4.data.codes.length).toBe(0)
  })

  it('prevents use of disabled codes', async () => {
    const first = await createInviteCode(network, agent, 1)
    const account = await makeLoggedInAccount(network, agent)
    const second = await createInviteCode(network, agent, 1, account.accountDid)

    // disabled first by code & second by did
    await agent.api.com.atproto.admin.disableInviteCodes(
      {
        codes: [first],
        accounts: [account.accountDid],
      },
      {
        headers: network.pds.adminAuthHeaders(),
        encoding: 'application/json',
      },
    )

    await expect(createAccountWithInvite(agent, first)).rejects.toThrow(
      ComAtprotoServerCreateAccount.InvalidInviteCodeError,
    )
    await expect(createAccountWithInvite(agent, second)).rejects.toThrow(
      ComAtprotoServerCreateAccount.InvalidInviteCodeError,
    )
  })

  it('does not allow disabling all admin codes', async () => {
    const attempt = agent.api.com.atproto.admin.disableInviteCodes(
      {
        accounts: ['admin'],
      },
      {
        headers: network.pds.adminAuthHeaders(),
        encoding: 'application/json',
      },
    )
    await expect(attempt).rejects.toThrow('cannot disable admin invite codes')
  })

  it('creates many invite codes', async () => {
    const accounts = ['did:example:one', 'did:example:two', 'did:example:three']
    const res = await agent.api.com.atproto.server.createInviteCodes(
      {
        useCount: 2,
        codeCount: 2,
        forAccounts: accounts,
      },
      {
        headers: network.pds.adminAuthHeaders(),
        encoding: 'application/json',
      },
    )
    expect(res.data.codes.length).toBe(3)
    const fromDb = await ctx.accountManager.db.db
      .selectFrom('invite_code')
      .selectAll()
      .where('forAccount', 'in', accounts)
      .execute()
    expect(fromDb.length).toBe(6)
    const dbCodesByUser = {}
    for (const row of fromDb) {
      expect(row.disabled).toBe(0)
      expect(row.availableUses).toBe(2)
      dbCodesByUser[row.forAccount] ??= []
      dbCodesByUser[row.forAccount].push(row.code)
    }
    for (const { account, codes } of res.data.codes) {
      expect(codes.length).toBe(2)
      expect(codes.sort()).toEqual(dbCodesByUser[account].sort())
    }
  })
})

const createInviteCode = async (
  network: TestNetworkNoAppView,
  agent: AtpAgent,
  uses: number,
  forAccount?: string,
): Promise<string> => {
  const res = await agent.api.com.atproto.server.createInviteCode(
    { useCount: uses, forAccount },
    {
      headers: network.pds.adminAuthHeaders(),
      encoding: 'application/json',
    },
  )
  return res.data.code
}

const createAccountWithInvite = async (agent: AtpAgent, code: string) => {
  const name = crypto.randomStr(5, 'base32')
  const res = await agent.api.com.atproto.server.createAccount({
    email: `${name}@test.com`,
    handle: `${name}.test`,
    password: name,
    inviteCode: code,
  })
  return {
    ...res.data,
    password: name,
  }
}

const createAccountsWithInvite = async (
  agent: AtpAgent,
  code: string,
  count = 0,
) => {
  for (let i = 0; i < count; i++) {
    await createAccountWithInvite(agent, code)
  }
}

const makeLoggedInAccount = async (
  network: TestNetworkNoAppView,
  inviterAgent: AtpAgent,
) => {
  const code = await createInviteCode(network, inviterAgent, 1)
  const account = await createAccountWithInvite(inviterAgent, code)
  const agent = network.pds.getClient()
  await agent.login({
    identifier: account.handle,
    password: account.password, //TODO: change to ethAddress
  })
  return agent
}
