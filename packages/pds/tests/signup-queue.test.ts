import { once } from 'events'
import AtpAgent, { ComAtprotoServerResetPassword } from '@atproto/api'
import * as crypto from '@atproto/crypto'
import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import Mail from 'nodemailer/lib/mailer'
import { AppContext } from '../src'
import {
  DISABLE_SIGNUPS_FLAG,
  PERIOD_ALLOWANCE_FLAG,
  PERIOD_MS_FLAG,
} from '../src/signup-queue'
import { DAY } from '@atproto/common'
import assert from 'assert'
import { create } from 'domain'

describe('signup queue', () => {
  let network: TestNetworkNoAppView
  let ctx: AppContext
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'signup_queue',
    })
    ctx = network.pds.ctx
    agent = network.pds.getClient()
    sc = network.getSeedClient()

    await ctx.db.db
      .insertInto('runtime_flag')
      .values([
        {
          name: DISABLE_SIGNUPS_FLAG,
          value: 'false',
        },
        {
          name: PERIOD_ALLOWANCE_FLAG,
          value: '2',
        },
        {
          name: PERIOD_MS_FLAG,
          value: DAY.toString(),
        },
      ])
      .execute()
    await ctx.signupLimiter.refresh()
  })

  afterAll(async () => {
    await network.close()
  })

  const createAccount = (name: string) => {
    return sc.createAccount(name, {
      handle: `${name}.test`,
      email: `${name}@test.com`,
      password: `${name}-pass`,
    })
  }

  let deactivated: string

  it('does not activate accounts that exceed signups', async () => {
    const one = await createAccount('one')
    await ctx.signupLimiter.refresh()
    const two = await createAccount('two')
    await ctx.signupLimiter.refresh()
    const three = await createAccount('three')
    await ctx.signupLimiter.refresh()
    await ctx.signupActivator.activateBatch()
    deactivated = three.did

    const accounts = await ctx.db.db
      .selectFrom('user_account')
      .selectAll()
      .where('did', 'in', [one.did, two.did, three.did])
      .execute()
    const oneRow = accounts.find((row) => row.did === one.did)
    assert(oneRow)
    const twoRow = accounts.find((row) => row.did === two.did)
    assert(twoRow)
    const threeRow = accounts.find((row) => row.did === three.did)
    assert(threeRow)

    expect(oneRow.activatedAt).toEqual(oneRow.createdAt)
    expect(twoRow.activatedAt).toEqual(twoRow.createdAt)
    expect(threeRow.activatedAt).toBeNull()
  })

  it('allows an account to check their status in the queue', async () => {
    const four = await createAccount('four')
    await ctx.signupLimiter.refresh()
    await ctx.signupActivator.activateBatch()

    const res = await agent.api.com.atproto.temp.checkSignupQueue(undefined, {
      headers: sc.getHeaders(four.did),
    })
    expect(res.data.activated).toBe(false)
    expect(res.data.placeInQueue).toBe(1)
    expect(res.data.estimatedTimeMs).toBe(0.5 * DAY)
  })

  it('does not allow an account to perform other actions on their pds', async () => {
    const five = await createAccount('five')
    await ctx.signupLimiter.refresh()
    await ctx.signupActivator.activateBatch()

    await agent.api
    const attempt1 = agent.api.app.bsky.feed.getTimeline(
      {},
      {
        headers: sc.getHeaders(five.did),
      },
    )
    await expect(attempt1).rejects.toThrow('Bad token scope')

    const attempt2 = agent.api.app.bsky.actor.getPreferences(
      {},
      {
        headers: sc.getHeaders(five.did),
      },
    )
    await expect(attempt2).rejects.toThrow('Bad token scope')

    const attempt3 = agent.api.app.bsky.feed.post.create(
      { repo: five.did },
      {
        text: 'test',
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(five.did),
    )
    await expect(attempt3).rejects.toThrow('Bad token scope')
  })

  it('returns a deactived access token on refresh as well', async () => {
    const six = await createAccount('six')
    await ctx.signupLimiter.refresh()
    await ctx.signupActivator.activateBatch()

    const refreshed = await agent.api.com.atproto.server.refreshSession(
      undefined,
      {
        headers: { authorization: `Bearer ${six.refreshJwt}` },
      },
    )

    const attempt = agent.api.app.bsky.feed.getTimeline(
      {},
      {
        headers: { authorization: `Bearer ${refreshed.data.accessJwt}` },
      },
    )
    await expect(attempt).rejects.toThrow('Bad token scope')
  })

  it('automatically activates accounts when its their time', async () => {
    await ctx.db.db
      .updateTable('runtime_flag')
      .set({ value: '100' })
      .where('name', '=', PERIOD_ALLOWANCE_FLAG)
      .execute()
    await ctx.signupLimiter.refresh()
    await ctx.signupActivator.activateBatch()

    const res = await ctx.db.db
      .selectFrom('user_account')
      .selectAll()
      .where('activatedAt', 'is', null)
      .execute()
    expect(res.length).toBe(0)
  })

  it('returns a working access token on refresh after activation', async () => {
    const deactivatedRefreshToken = sc.accounts[deactivated].refreshJwt
    const refreshed = await agent.api.com.atproto.server.refreshSession(
      undefined,
      {
        headers: { authorization: `Bearer ${deactivatedRefreshToken}` },
      },
    )

    await agent.api.app.bsky.actor.getPreferences(
      {},
      {
        headers: { authorization: `Bearer ${refreshed.data.accessJwt}` },
      },
    )
  })

  it('disables and reenables signups entirely', async () => {
    await ctx.db.db
      .updateTable('runtime_flag')
      .set({ value: 'true' })
      .where('name', '=', DISABLE_SIGNUPS_FLAG)
      .execute()
    await ctx.signupLimiter.refresh()
    const seven = await createAccount('seven')
    await ctx.signupActivator.activateBatch()

    const accountRowBefore = await ctx.db.db
      .selectFrom('user_account')
      .selectAll()
      .where('did', '=', seven.did)
      .executeTakeFirst()
    assert(accountRowBefore)
    expect(accountRowBefore.activatedAt).toBeNull()

    await ctx.db.db
      .updateTable('runtime_flag')
      .set({ value: 'false' })
      .where('name', '=', DISABLE_SIGNUPS_FLAG)
      .execute()
    await ctx.signupLimiter.refresh()
    await ctx.signupActivator.activateBatch()

    const accountRowAfter = await ctx.db.db
      .selectFrom('user_account')
      .selectAll()
      .where('did', '=', seven.did)
      .executeTakeFirst()
    assert(accountRowAfter)
    expect(typeof accountRowAfter.activatedAt).toBe('string')
  })
})
