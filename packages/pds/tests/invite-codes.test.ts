import AtpAgent, { ComAtprotoServerCreateAccount } from '@atproto/api'
import * as crypto from '@atproto/crypto'
import { AppContext } from '../src'
import * as util from './_util'
import { DAY } from '@atproto/common'
import { genInvCodes } from '../src/api/com/atproto/server/util'
import { TAKEDOWN } from '@atproto/api/src/client/types/com/atproto/admin/defs'

describe('account', () => {
  let serverUrl: string
  let ctx: AppContext
  let agent: AtpAgent
  let close: util.CloseFn

  beforeAll(async () => {
    const server = await util.runTestServer({
      inviteRequired: true,
      userInviteInterval: DAY,
      userInviteEpoch: Date.now() - 3 * DAY,
      dbPostgresSchema: 'invite_codes',
    })
    close = server.close
    ctx = server.ctx
    serverUrl = server.url
    agent = new AtpAgent({ service: serverUrl })
  })

  afterAll(async () => {
    await close()
  })

  it('describes the fact that invites are required', async () => {
    const res = await agent.api.com.atproto.server.describeServer({})
    expect(res.data.inviteCodeRequired).toBe(true)
  })

  it('succeeds with a valid code', async () => {
    const code = await createInviteCode(agent, 1)
    await createAccountWithInvite(agent, code)
  })

  it('fails on bad invite code', async () => {
    const promise = createAccountWithInvite(agent, 'fake-invite')
    await expect(promise).rejects.toThrow(
      ComAtprotoServerCreateAccount.InvalidInviteCodeError,
    )
  })

  it('fails on invite code from takendown account', async () => {
    const account = await makeLoggedInAccount(agent)
    // assign an invite code to the user
    const code = await createInviteCode(agent, 1, account.did)
    // takedown the user's account
    const { data: takedownAction } =
      await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: TAKEDOWN,
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: account.did,
          },
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: util.adminAuth() },
        },
      )
    // attempt to create account with the previously generated invite code
    const promise = createAccountWithInvite(agent, code)
    await expect(promise).rejects.toThrow(
      ComAtprotoServerCreateAccount.InvalidInviteCodeError,
    )

    // double check that reversing the takedown action makes the invite code valid again
    await agent.api.com.atproto.admin.reverseModerationAction(
      {
        id: takedownAction.id,
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: util.adminAuth() },
      },
    )
    // attempt to create account with the previously generated invite code
    await createAccountWithInvite(agent, code)
  })

  it('fails on used up invite code', async () => {
    const code = await createInviteCode(agent, 2)
    await createAccountsWithInvite(agent, code, 2)
    const promise = createAccountWithInvite(agent, code)
    await expect(promise).rejects.toThrow(
      ComAtprotoServerCreateAccount.InvalidInviteCodeError,
    )
  })

  it('handles racing invite code uses', async () => {
    const inviteCode = await createInviteCode(agent, 1)
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
    const account = await makeLoggedInAccount(agent)

    // no codes available yet
    const res1 =
      await account.agent.api.com.atproto.server.getAccountInviteCodes()
    expect(res1.data.codes.length).toBe(0)

    // next, pretend account was made 2 days in the past
    const twoDaysAgo = new Date(Date.now() - 2 * DAY).toISOString()
    await ctx.db.db
      .updateTable('user_account')
      .set({ createdAt: twoDaysAgo })
      .where('did', '=', account.did)
      .execute()
    const res2 =
      await account.agent.api.com.atproto.server.getAccountInviteCodes()
    expect(res2.data.codes.length).toBe(2)

    // use both invites and confirm we can't get any more
    for (const code of res2.data.codes) {
      await createAccountWithInvite(agent, code.code)
    }

    const res3 =
      await account.agent.api.com.atproto.server.getAccountInviteCodes()
    expect(res3.data.codes.length).toBe(2)
  })

  it('admin gifted codes to not impact a users available codes', async () => {
    const account = await makeLoggedInAccount(agent)

    // again, pretend account was made 2 days ago
    const twoDaysAgo = new Date(Date.now() - 2 * DAY).toISOString()
    await ctx.db.db
      .updateTable('user_account')
      .set({ createdAt: twoDaysAgo })
      .where('did', '=', account.did)
      .execute()

    await createInviteCode(agent, 1, account.did)
    await createInviteCode(agent, 1, account.did)
    await createInviteCode(agent, 1, account.did)

    const res =
      await account.agent.api.com.atproto.server.getAccountInviteCodes()
    expect(res.data.codes.length).toBe(5)

    const fromAdmin = res.data.codes.filter(
      (code) => code.createdBy === 'admin',
    )
    expect(fromAdmin.length).toBe(3)

    const fromSelf = res.data.codes.filter(
      (code) => code.createdBy === account.did,
    )
    expect(fromSelf.length).toBe(2)
  })

  it('creates invites based on epoch', async () => {
    const account = await makeLoggedInAccount(agent)

    // first, pretend account was made 2 days ago & get those two codes
    const twoDaysAgo = new Date(Date.now() - 2 * DAY).toISOString()
    await ctx.db.db
      .updateTable('user_account')
      .set({ createdAt: twoDaysAgo })
      .where('did', '=', account.did)
      .execute()

    const res1 =
      await account.agent.api.com.atproto.server.getAccountInviteCodes()
    expect(res1.data.codes.length).toBe(2)

    // then pretend account was made ever so slightly over 10 days ago
    const tenDaysAgo = new Date(Date.now() - 10.01 * DAY).toISOString()
    await ctx.db.db
      .updateTable('user_account')
      .set({ createdAt: tenDaysAgo })
      .where('did', '=', account.did)
      .execute()

    // we have a 3 day epoch so should still get 3 code
    const res2 =
      await account.agent.api.com.atproto.server.getAccountInviteCodes()
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
      forUser: account.did,
      createdBy: account.did,
      createdAt: new Date(Date.now() - 5 * DAY).toISOString(),
    }))
    await ctx.db.db.insertInto('invite_code').values(inviteRows).execute()
    const res3 =
      await account.agent.api.com.atproto.server.getAccountInviteCodes({
        includeUsed: false,
      })
    expect(res3.data.codes.length).toBe(10)

    // no we use the codes which should still not allow them to generate anymore
    await ctx.db.db
      .insertInto('invite_code_use')
      .values(
        inviteRows.map((row) => ({
          code: row.code,
          usedBy: 'did:example:test',
          usedAt: new Date().toISOString(),
        })),
      )
      .execute()

    const res4 =
      await account.agent.api.com.atproto.server.getAccountInviteCodes({
        includeUsed: false,
      })
    expect(res4.data.codes.length).toBe(0)
  })

  it('prevents use of disabled codes', async () => {
    const first = await createInviteCode(agent, 1)
    const account = await makeLoggedInAccount(agent)
    const second = await createInviteCode(agent, 1, account.did)

    // disabled first by code & second by did
    await agent.api.com.atproto.admin.disableInviteCodes(
      {
        codes: [first],
        accounts: [account.did],
      },
      {
        headers: { authorization: util.adminAuth() },
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
        headers: { authorization: util.adminAuth() },
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
        headers: { authorization: util.adminAuth() },
        encoding: 'application/json',
      },
    )
    expect(res.data.codes.length).toBe(3)
    const fromDb = await ctx.db.db
      .selectFrom('invite_code')
      .selectAll()
      .where('forUser', 'in', accounts)
      .execute()
    expect(fromDb.length).toBe(6)
    const dbCodesByUser = {}
    for (const row of fromDb) {
      expect(row.disabled).toBe(0)
      expect(row.availableUses).toBe(2)
      dbCodesByUser[row.forUser] ??= []
      dbCodesByUser[row.forUser].push(row.code)
    }
    for (const { account, codes } of res.data.codes) {
      expect(codes.length).toBe(2)
      expect(codes.sort()).toEqual(dbCodesByUser[account].sort())
    }
  })
})

const createInviteCode = async (
  agent: AtpAgent,
  uses: number,
  forAccount?: string,
): Promise<string> => {
  const res = await agent.api.com.atproto.server.createInviteCode(
    { useCount: uses, forAccount },
    {
      headers: { authorization: util.adminAuth() },
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
  agent: AtpAgent,
): Promise<{ did: string; agent: AtpAgent }> => {
  const code = await createInviteCode(agent, 1)
  const account = await createAccountWithInvite(agent, code)
  const did = account.did
  const loggedInAgent = new AtpAgent({ service: agent.service.toString() })
  await loggedInAgent.login({
    identifier: account.handle,
    password: account.password,
  })
  return {
    did,
    agent: loggedInAgent,
  }
}
